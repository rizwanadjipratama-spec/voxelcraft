import * as THREE from 'three';
import { BLOCK_COLORS } from '../world/Constants';

interface Particle {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    life: number;
}

export class ParticleSystem {
    private scene: THREE.Scene;
    private particles: Particle[] = [];
    private geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    public spawn(pos: THREE.Vector3, color: number, count: number = 12) {
        const mat = new THREE.MeshBasicMaterial({ color: color });
        for (let i = 0; i < count; i++) {
            const mesh = new THREE.Mesh(this.geometry, mat);
            mesh.position.set(
                pos.x + (Math.random() - 0.5),
                pos.y + (Math.random() - 0.5),
                pos.z + (Math.random() - 0.5)
            );
            
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.2,
                Math.random() * 0.2 + 0.1,
                (Math.random() - 0.5) * 0.2
            );

            this.particles.push({ mesh, velocity, life: 1.0 });
            this.scene.add(mesh);
        }
    }

    public update(delta: number) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= delta;
            
            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                this.particles.splice(i, 1);
                continue;
            }

            p.velocity.y -= 0.6 * delta; // Gravity
            p.mesh.position.add(p.velocity.clone().multiplyScalar(60 * delta));
            p.mesh.scale.set(p.life, p.life, p.life);
        }
    }

    public getBlockColor(type: number): number {
        return BLOCK_COLORS[type] || 0xffffff;
    }
}
