import * as THREE from 'three';
import { World } from '../world/World';

export enum MobType { PIG, COW, ZOMBIE, CREEPER, SKELETON }

// What each mob drops on death
export const MOB_DROPS: Record<MobType, { type: string; count: number }[]> = {
    [MobType.PIG]: [{ type: 'food', count: 3 }],
    [MobType.COW]: [{ type: 'food', count: 2 }, { type: 'leather', count: 1 }],
    [MobType.ZOMBIE]: [{ type: 'xp', count: 5 }],
    [MobType.CREEPER]: [{ type: 'xp', count: 10 }],
    [MobType.SKELETON]: [{ type: 'xp', count: 5 }, { type: 'bone', count: 1 }],
};

interface Arrow {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    life: number;
}

export class Mob {
    public mesh: THREE.Group;
    public pos: THREE.Vector3;
    public velocity: THREE.Vector3 = new THREE.Vector3();
    public health: number = 10;
    private world: World;
    private scene: THREE.Scene;
    public type: MobType;
    public isDead = false;

    private wanderTimer = 0;
    private wanderDir: THREE.Vector3 = new THREE.Vector3();
    private attackCooldown = 0;

    // Creeper
    private fuseTimer = -1;
    private fuseLength = 1.5;
    private flashMesh: THREE.Mesh | null = null;
    private onExplode: ((pos: THREE.Vector3) => void) | null = null;

    // Skeleton
    private arrows: Arrow[] = [];
    private shootCooldown = 0;

    // Callbacks
    public onDeath: ((mob: Mob) => void) | null = null;

    constructor(scene: THREE.Scene, world: World, type: MobType, startPos: THREE.Vector3, explodeCallback?: (pos: THREE.Vector3) => void) {
        this.scene = scene;
        this.world = world;
        this.type = type;
        this.pos = startPos.clone();
        this.onExplode = explodeCallback || null;

        if (type === MobType.CREEPER) this.health = 20;
        if (type === MobType.SKELETON) this.health = 20;
        if (type === MobType.ZOMBIE) this.health = 20;

        this.mesh = new THREE.Group();
        this.initModel();
        scene.add(this.mesh);
    }

    private initModel() {
        let bodyColor: number;
        switch (this.type) {
            case MobType.ZOMBIE: bodyColor = 0x2e7d32; break;
            case MobType.PIG: bodyColor = 0xffaaaa; break;
            case MobType.COW: bodyColor = 0x8b4513; break;
            case MobType.CREEPER: bodyColor = 0x3a8a3a; break;
            case MobType.SKELETON: bodyColor = 0xcccccc; break;
        }

        const mat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 1 });

        if (this.type === MobType.CREEPER) {
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.0, 0.4), mat);
            body.position.y = 0.7; this.mesh.add(body);
            const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), mat);
            head.position.y = 1.45; this.mesh.add(head);
            const faceMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
            const eye1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.02), faceMat);
            eye1.position.set(-0.12, 1.5, 0.26); this.mesh.add(eye1);
            const eye2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.02), faceMat);
            eye2.position.set(0.12, 1.5, 0.26); this.mesh.add(eye2);
            const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.02), faceMat);
            mouth.position.set(0, 1.35, 0.26); this.mesh.add(mouth);
            for (let i = 0; i < 4; i++) {
                const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.15), mat);
                leg.position.set(i % 2 === 0 ? 0.15 : -0.15, 0.05, i < 2 ? 0.1 : -0.1);
                this.mesh.add(leg);
            }
            this.flashMesh = new THREE.Mesh(
                new THREE.BoxGeometry(0.55, 1.8, 0.55),
                new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
            );
            this.flashMesh.position.y = 0.9; this.mesh.add(this.flashMesh);
        } else if (this.type === MobType.SKELETON) {
            // Skeleton: thin white body
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.2), mat);
            body.position.y = 0.6; this.mesh.add(body);
            const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), mat);
            head.position.y = 1.15; this.mesh.add(head);
            // Eyes
            const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
            const eye1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.02), eyeMat);
            eye1.position.set(-0.08, 1.2, 0.18); this.mesh.add(eye1);
            const eye2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.02), eyeMat);
            eye2.position.set(0.08, 1.2, 0.18); this.mesh.add(eye2);
            // Arms
            const armMat = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, roughness: 1 });
            const arm1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.1), armMat);
            arm1.position.set(-0.25, 0.5, 0); this.mesh.add(arm1);
            const arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.1), armMat);
            arm2.position.set(0.25, 0.5, 0); this.mesh.add(arm2);
            // Legs
            for (let i = 0; i < 2; i++) {
                const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), mat);
                leg.position.set(i === 0 ? 0.1 : -0.1, 0, 0);
                this.mesh.add(leg);
            }
        } else if (this.type === MobType.ZOMBIE) {
            // Humanoid zombie
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), mat);
            body.position.y = 0.55; this.mesh.add(body);
            const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), mat);
            head.position.y = 1.1; this.mesh.add(head);
            const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
            const eye1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.02), eyeMat);
            eye1.position.set(-0.1, 1.15, 0.21); this.mesh.add(eye1);
            const eye2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.02), eyeMat);
            eye2.position.set(0.1, 1.15, 0.21); this.mesh.add(eye2);
            // Arms extended forward
            const armMat = new THREE.MeshStandardMaterial({ color: 0x226622, roughness: 1 });
            const arm1 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 0.15), armMat);
            arm1.position.set(-0.35, 0.6, 0.3); arm1.rotation.x = -Math.PI / 4; this.mesh.add(arm1);
            const arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 0.15), armMat);
            arm2.position.set(0.35, 0.6, 0.3); arm2.rotation.x = -Math.PI / 4; this.mesh.add(arm2);
            for (let i = 0; i < 2; i++) {
                const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.4, 0.15), mat);
                leg.position.set(i === 0 ? 0.15 : -0.15, 0, 0);
                this.mesh.add(leg);
            }
        } else {
            // Pig/Cow - animal body
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.9), mat);
            body.position.y = 0.35; this.mesh.add(body);
            const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.35), mat);
            head.position.set(0, 0.45, 0.5); this.mesh.add(head);
            // Snout for pig
            if (this.type === MobType.PIG) {
                const snout = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.1), new THREE.MeshStandardMaterial({ color: 0xee9999, roughness: 1 }));
                snout.position.set(0, 0.4, 0.68); this.mesh.add(snout);
            }
            // Spots for cow
            if (this.type === MobType.COW) {
                const spotMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
                const spot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.01), spotMat);
                spot.position.set(0.1, 0.4, -0.46); this.mesh.add(spot);
            }
            for (let i = 0; i < 4; i++) {
                const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.15), mat);
                leg.position.set(i % 2 === 0 ? 0.2 : -0.2, 0, i < 2 ? 0.3 : -0.3);
                this.mesh.add(leg);
            }
        }
    }

    public takeDamage(amount: number, sourcePos: THREE.Vector3) {
        this.health -= amount;
        const knockback = this.pos.clone().sub(sourcePos).normalize().multiplyScalar(0.5);
        this.velocity.add(knockback);
        this.velocity.y = 0.2;
        // Flash red
        this.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
                const orig = child.material.color.getHex();
                child.material.color.set(0xff0000);
                setTimeout(() => child.material.color.set(orig), 100);
            }
        });
        if (this.health <= 0) this.die();
    }

    private die() {
        this.isDead = true;
        this.mesh.visible = false;
        // Clean up arrows
        this.arrows.forEach(a => { this.scene.remove(a.mesh); a.mesh.geometry.dispose(); });
        this.arrows = [];
        if (this.onDeath) this.onDeath(this);
    }

    private shootArrow(target: THREE.Vector3) {
        const dir = target.clone().sub(this.pos).normalize();
        const arrowGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4);
        arrowGeo.rotateX(Math.PI / 2);
        const arrowMat = new THREE.MeshBasicMaterial({ color: 0x8b6914 });
        const mesh = new THREE.Mesh(arrowGeo, arrowMat);
        mesh.position.copy(this.pos).add(new THREE.Vector3(0, 1, 0));
        mesh.lookAt(target);
        this.scene.add(mesh);
        this.arrows.push({ mesh, velocity: dir.multiplyScalar(0.5), life: 3 });
    }

    public update(delta: number, playerPos: THREE.Vector3, onAttack: () => void) {
        if (this.isDead) return;

        this.attackCooldown -= delta;
        this.shootCooldown -= delta;
        const distToPlayer = this.pos.distanceTo(playerPos);

        // Update arrows
        for (let i = this.arrows.length - 1; i >= 0; i--) {
            const a = this.arrows[i];
            a.life -= delta;
            a.mesh.position.add(a.velocity.clone().multiplyScalar(60 * delta));
            a.velocity.y -= 0.01; // Gravity on arrow
            // Hit player?
            if (a.mesh.position.distanceTo(playerPos) < 1.0) {
                onAttack(); // Damage!
                this.scene.remove(a.mesh);
                this.arrows.splice(i, 1);
                continue;
            }
            if (a.life <= 0) {
                this.scene.remove(a.mesh);
                this.arrows.splice(i, 1);
            }
        }

        // AI
        if (this.type === MobType.CREEPER) {
            if (distToPlayer < 16) {
                const dir = playerPos.clone().sub(this.pos).normalize();
                this.wanderDir.set(dir.x, 0, dir.z);
            } else {
                this.wanderTimer -= delta;
                if (this.wanderTimer <= 0) {
                    this.wanderTimer = 2 + Math.random() * 3;
                    const angle = Math.random() * Math.PI * 2;
                    this.wanderDir.set(Math.cos(angle), 0, Math.sin(angle));
                }
            }
            if (distToPlayer < 3 && this.fuseTimer < 0) this.fuseTimer = 0;
            if (distToPlayer > 5 && this.fuseTimer >= 0) {
                this.fuseTimer = -1;
                if (this.flashMesh) (this.flashMesh.material as THREE.MeshBasicMaterial).opacity = 0;
            }
            if (this.fuseTimer >= 0) {
                this.fuseTimer += delta;
                if (this.flashMesh) {
                    (this.flashMesh.material as THREE.MeshBasicMaterial).opacity = Math.sin(this.fuseTimer * 10) > 0 ? 0.6 : 0;
                }
                if (this.fuseTimer >= this.fuseLength) {
                    if (this.onExplode) this.onExplode(this.pos.clone());
                    onAttack();
                    this.die();
                    return;
                }
            }
        } else if (this.type === MobType.SKELETON) {
            // Skeleton: keeps distance, shoots arrows
            if (distToPlayer < 16 && distToPlayer > 6) {
                const dir = playerPos.clone().sub(this.pos).normalize();
                this.wanderDir.set(dir.x, 0, dir.z);
            } else if (distToPlayer <= 6) {
                // Back away
                const dir = this.pos.clone().sub(playerPos).normalize();
                this.wanderDir.set(dir.x, 0, dir.z);
            } else {
                this.wanderTimer -= delta;
                if (this.wanderTimer <= 0) {
                    this.wanderTimer = 2 + Math.random() * 3;
                    const angle = Math.random() * Math.PI * 2;
                    this.wanderDir.set(Math.cos(angle), 0, Math.sin(angle));
                }
            }
            // Shoot
            if (distToPlayer < 16 && this.shootCooldown <= 0) {
                this.shootArrow(playerPos);
                this.shootCooldown = 2.0;
            }
        } else if (this.type === MobType.ZOMBIE && distToPlayer < 12) {
            const dir = playerPos.clone().sub(this.pos).normalize();
            this.wanderDir.set(dir.x, 0, dir.z);
            if (distToPlayer < 1.5 && this.attackCooldown <= 0) {
                onAttack();
                this.attackCooldown = 1.5;
            }
        } else {
            this.wanderTimer -= delta;
            if (this.wanderTimer <= 0) {
                this.wanderTimer = 2 + Math.random() * 3;
                if (Math.random() > 0.5) {
                    const angle = Math.random() * Math.PI * 2;
                    this.wanderDir.set(Math.cos(angle), 0, Math.sin(angle));
                } else this.wanderDir.set(0, 0, 0);
            }
        }

        // Movement
        const speed = (this.type === MobType.ZOMBIE ? 3.0 : (this.type === MobType.CREEPER ? 2.5 : (this.type === MobType.SKELETON ? 2.8 : 2.0))) * delta;
        this.velocity.x = this.wanderDir.x * speed;
        this.velocity.z = this.wanderDir.z * speed;
        this.velocity.y -= 0.08;

        const nextPos = this.pos.clone().add(this.velocity);
        const blockAt = this.world.getBlockAt(nextPos.x, nextPos.y, nextPos.z);
        if (blockAt !== 0 && blockAt !== 6 && blockAt !== 20 && blockAt !== 21 && blockAt !== 22) {
            const above = this.world.getBlockAt(nextPos.x, nextPos.y + 1, nextPos.z);
            if (above === 0 || above === 6 || above === 20 || above === 21 || above === 22) this.pos.y += 0.6;
            else { this.velocity.set(0, 0, 0); this.wanderTimer = 0; }
        } else this.pos.copy(nextPos);

        this.mesh.position.copy(this.pos);
        if (this.wanderDir.length() > 0) {
            const targetRot = Math.atan2(this.wanderDir.x, this.wanderDir.z);
            this.mesh.rotation.y = THREE.MathUtils.lerp(this.mesh.rotation.y, targetRot, 0.1);
        }
    }
}
