import * as THREE from 'three';
import { Controls, GameMode } from './Controls';
import { World } from '../world/World';
import { AudioManager } from './AudioManager';
import { Mob, MobType, MOB_DROPS } from './Mob';
import { NetworkManager } from './NetworkManager';
import { ParticleSystem } from './ParticleSystem';
import { BLOCK_TYPE, BLOCK_HARDNESS, BLOCK_NAMES, ALL_BLOCKS, BLOCK_COLORS } from '../world/Constants';

export class Engine {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private clock: THREE.Clock;
    private controls!: Controls;
    private world!: World;
    private network!: NetworkManager;
    private particles!: ParticleSystem;
    private mobs: Mob[] = [];
    private prevPos: THREE.Vector3 = new THREE.Vector3();

    private selectionBox!: THREE.Mesh;
    private sun!: THREE.DirectionalLight;
    private moon!: THREE.DirectionalLight;
    private ambientLight!: THREE.AmbientLight;
    private handModel!: THREE.Group;
    private stars!: THREE.Points;

    private isMining = false;
    private isPlacing = false;
    private isSwinging = false;
    private isPaused = false;
    private chatActive = false;
    private placeCooldown = 0;
    private miningProgress = 0;
    private miningTarget: { x: number; y: number; z: number } | null = null;

    private health = 20;
    private hunger = 20;
    private hungerTick = 0;
    private isDead = false;
    private inventoryOpen = false;
    private gameStarted = false;
    private saveTimer = 0;
    private stepTimer = 0;

    // Inventory: blockType -> count
    private inventory: Map<number, number> = new Map();
    // Hotbar: which block type is in each slot (0-8)
    private hotbarItems: number[] = [1, 2, 3, 9, 7, 4, 5, 10, 8];

    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x87CEEB);
        document.body.appendChild(this.renderer.domElement);
        this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.004);
        this.clock = new THREE.Clock();

        this.world = new World(this.scene);
        this.loadPlayerState();
        this.world.update(this.camera.position);
        this.controls = new Controls(this.camera, this.renderer.domElement, this.world);
        this.particles = new ParticleSystem(this.scene);
        this.network = new NetworkManager(this.scene, this.world);

        this.initAtmosphere();
        this.initSelectionBox();
        this.initHand();
        this.initMobs();
        this.initMenu();
        this.initInteraction();
        this.initSettings();
        this.initChat();
        this.initHybridDetection();
        this.handleResize();

        // Fall damage callback
        this.controls.setOnFall((dist) => {
            const damage = Math.floor(dist - 3);
            if (damage > 0) this.takeDamage(damage);
        });

        this.animate();
    }

    private getTerrainHeight(x: number, z: number): number {
        const hash = (n: number) => { let v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
        const noise2D = (nx: number, nz: number) => {
            const ix = Math.floor(nx), iz = Math.floor(nz);
            const fx = nx - ix, fz = nz - iz;
            const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
            const a = hash(ix + iz * 131.1), b = hash(ix + 1 + iz * 131.1);
            const c = hash(ix + (iz + 1) * 131.1), d = hash(ix + 1 + (iz + 1) * 131.1);
            return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
        };
        const fbm = (nx: number, nz: number, oct: number) => {
            let val = 0, amp = 1, freq = 1, max = 0;
            for (let i = 0; i < oct; i++) { val += noise2D(nx * freq, nz * freq) * amp; max += amp; amp *= 0.5; freq *= 2; }
            return val / max;
        };
        const continental = fbm(x / 200, z / 200, 4);
        const detail = fbm(x / 40, z / 40, 3) * 0.3;
        const mountain = Math.pow(fbm(x / 80, z / 80, 4), 2) * 40;
        return Math.max(1, Math.min(126, Math.floor(continental * 30 + detail * 15 + mountain + 50)));
    }

    private initAtmosphere() {
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(this.ambientLight);
        this.sun = new THREE.DirectionalLight(0xffffcc, 1.2);
        this.sun.position.set(100, 200, 100);
        this.scene.add(this.sun);
        this.moon = new THREE.DirectionalLight(0xccccff, 0.4);
        this.moon.position.set(-100, -200, -100);
        this.scene.add(this.moon);

        const starPos: number[] = [];
        for (let i = 0; i < 1000; i++) starPos.push((Math.random() - 0.5) * 1000, Math.random() * 500 + 100, (Math.random() - 0.5) * 1000);
        const starGeo = new THREE.BufferGeometry();
        starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
        this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1, transparent: true }));
        this.scene.add(this.stars);

        const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
        for (let i = 0; i < 20; i++) {
            const cloud = new THREE.Mesh(new THREE.BoxGeometry(30 + Math.random() * 20, 4, 30 + Math.random() * 20), cloudMat);
            cloud.position.set((Math.random() - 0.5) * 1000, 100 + Math.random() * 15, (Math.random() - 0.5) * 1000);
            this.scene.add(cloud);
        }
    }

    private initSelectionBox() {
        this.selectionBox = new THREE.Mesh(
            new THREE.BoxGeometry(1.01, 1.01, 1.01),
            new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true, transparent: true, opacity: 0.5 })
        );
        this.scene.add(this.selectionBox);
    }

    private initHand() {
        this.handModel = new THREE.Group();
        const hand = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.4), new THREE.MeshStandardMaterial({ color: 0xdbac83 }));
        this.handModel.add(hand);
        this.camera.add(this.handModel);
        this.scene.add(this.camera);
    }

    private initMobs() {
        this.mobs = [];
        for (let i = 0; i < 3; i++)
            this.mobs.push(new Mob(this.scene, this.world, MobType.ZOMBIE, new THREE.Vector3(Math.random() * 100, 70, Math.random() * 100)));
        for (let i = 0; i < 4; i++) {
            const type = Math.random() > 0.5 ? MobType.PIG : MobType.COW;
            this.mobs.push(new Mob(this.scene, this.world, type, new THREE.Vector3(Math.random() * 100, 70, Math.random() * 100)));
        }
        for (let i = 0; i < 2; i++)
            this.mobs.push(new Mob(this.scene, this.world, MobType.CREEPER,
                new THREE.Vector3(Math.random() * 100, 70, Math.random() * 100),
                (pos) => this.creeperExplode(pos)
            ));
        for (let i = 0; i < 2; i++)
            this.mobs.push(new Mob(this.scene, this.world, MobType.SKELETON, new THREE.Vector3(Math.random() * 100, 70, Math.random() * 100)));

        this.mobs.forEach(m => {
            m.onDeath = (mob) => {
                const drops = MOB_DROPS[mob.type];
                if (drops && this.controls.gameMode === GameMode.SURVIVAL) {
                    drops.forEach(d => {
                        // For now just add to diamond count as 'loot' or use block IDs
                        const type = d.type === 'xp' ? BLOCK_TYPE.DIAMOND_ORE : BLOCK_TYPE.DIRT;
                        this.inventory.set(type, (this.inventory.get(type) || 0) + d.count);
                    });
                }
            };
        });
    }

    private creeperExplode(pos: THREE.Vector3) {
        const radius = 3;
        const cx = Math.floor(pos.x), cy = Math.floor(pos.y), cz = Math.floor(pos.z);
        for (let x = -radius; x <= radius; x++) {
            for (let y = -radius; y <= radius; y++) {
                for (let z = -radius; z <= radius; z++) {
                    if (x * x + y * y + z * z <= radius * radius) {
                        const block = this.world.getBlockAt(cx+x, cy+y, cz+z);
                        if (block !== 0) {
                            this.world.setBlockAt(cx + x, cy + y, cz + z, 0);
                            this.network.sendBlockUpdate(cx+x, cy+y, cz+z, 0);
                        }
                    }
                }
            }
        }
        this.particles.spawn(pos, 0xff4400, 30);
        this.particles.spawn(pos, 0x333333, 20);
        AudioManager.playBreakSound();
        if (this.camera.position.distanceTo(pos) < radius + 2) this.takeDamage(10);
    }

    private initHybridDetection() {
        const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent)
            || (window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 1024);
        const mobileUI = document.getElementById('mobile-controls');
        if (mobileUI) mobileUI.style.display = isMobile ? 'flex' : 'none';

        this.renderer.domElement.addEventListener('click', () => {
            if (this.gameStarted && !this.isDead && !this.isPaused && !this.chatActive && !this.inventoryOpen) {
                if (!document.pointerLockElement) this.renderer.domElement.requestPointerLock();
            }
        });
    }

    private initInteraction() {
        this.controls.setOnBlockAction((data: any) => {
            if (this.chatActive || this.isPaused || !this.gameStarted || this.isDead) return;
            if (data === 'inventory') this.toggleInventory();
            else if (data === 'start-break') { this.swingHand(); this.isMining = true; this.updateMiningTarget(); }
            else if (data === 'stop-break') { this.isMining = false; this.miningProgress = 0; const mp = document.getElementById('mining-progress'); if (mp) mp.style.display = 'none'; }
            else if (data === 'start-place') { this.swingHand(); this.isPlacing = true; this.placeCooldown = 0; }
            else if (data === 'stop-place') this.isPlacing = false;
        });
    }

    private initSettings() {
        const fov = document.getElementById('fov-slider') as HTMLInputElement;
        const sens = document.getElementById('sens-slider') as HTMLInputElement;
        const render = document.getElementById('render-slider') as HTMLInputElement;
        fov?.addEventListener('input', () => { this.camera.fov = parseInt(fov.value); this.camera.updateProjectionMatrix(); const el = document.getElementById('fov-val'); if (el) el.innerText = fov.value; });
        sens?.addEventListener('input', () => { this.controls.sensitivity = parseInt(sens.value) / 100; const el = document.getElementById('sens-val'); if (el) el.innerText = sens.value; });
        render?.addEventListener('input', () => { this.world.renderDistance = parseInt(render.value); const el = document.getElementById('render-val'); if (el) el.innerText = render.value; });
        document.getElementById('resume-btn')?.addEventListener('click', () => this.togglePause(false));
        document.getElementById('menu-btn')?.addEventListener('click', () => location.reload());
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.isDead && !this.chatActive && !this.inventoryOpen && this.gameStarted) this.togglePause(!this.isPaused);
        });
    }

    private initChat() {
        const input = document.getElementById('chat-input') as HTMLInputElement;
        const messages = document.getElementById('chat-messages');
        if (!input || !messages) return;
        this.network.onChatMessage = (msg: string) => {
            const div = document.createElement('div'); div.className = 'chat-msg'; div.innerText = msg;
            messages.appendChild(div); messages.scrollTo(0, messages.scrollHeight);
            setTimeout(() => div.remove(), 10000);
        };
        window.addEventListener('keydown', (e) => {
            if (e.key === 't' && !this.chatActive && !this.inventoryOpen && !this.isPaused && this.gameStarted) {
                e.preventDefault(); this.chatActive = true; input.style.display = 'block'; input.focus(); document.exitPointerLock();
            }
            if (e.key === 'Enter' && this.chatActive) {
                if (input.value.trim()) this.network.sendChat(input.value);
                input.value = ''; input.style.display = 'none'; this.chatActive = false; this.renderer.domElement.requestPointerLock();
            }
            if (e.key === 'Escape' && this.chatActive) {
                input.style.display = 'none'; this.chatActive = false; this.renderer.domElement.requestPointerLock();
            }
        });
    }

    private initMenu() {
        const startGame = (mode: GameMode) => {
            this.controls.gameMode = mode;
            this.controls.isFlying = mode === GameMode.CREATIVE;
            const menu = document.getElementById('menu'); if (menu) menu.style.display = 'none';
            const ui = document.getElementById('ui'); if (ui) ui.style.display = 'block';
            this.gameStarted = true;
            this.health = 20; this.hunger = 20;
            this.network.connect((document.getElementById('server-ip') as HTMLInputElement)?.value || 'http://localhost:3000');
            this.renderer.domElement.requestPointerLock();
            this.initCreativeInventory();
        };
        document.getElementById('survival-btn')?.addEventListener('click', () => startGame(GameMode.SURVIVAL));
        document.getElementById('creative-btn')?.addEventListener('click', () => startGame(GameMode.CREATIVE));
        document.getElementById('quit-btn')?.addEventListener('click', () => location.reload());

        document.getElementById('respawn-btn')?.addEventListener('click', () => {
            this.health = 20; this.hunger = 20; this.isDead = false;
            const y = this.getTerrainHeight(7.5, 7.5) + 1.8;
            this.camera.position.set(7.5, y, 7.5);
            this.prevPos.copy(this.camera.position);
            const ds = document.getElementById('death-screen'); if (ds) ds.style.display = 'none';
            const ui = document.getElementById('ui'); if (ui) ui.style.display = 'block';
            this.savePlayerState();
            this.renderer.domElement.requestPointerLock();
        });
        document.getElementById('title-btn')?.addEventListener('click', () => location.reload());
    }

    private initCreativeInventory() {
        const inv = document.getElementById('inventory-gui');
        if (!inv) return;
        inv.innerHTML = '';
        ALL_BLOCKS.forEach(type => {
            const slot = document.createElement('div');
            slot.className = 'inv-slot';
            slot.innerText = BLOCK_NAMES[type] || 'Block';
            slot.onclick = () => {
                this.hotbarItems[this.controls.selectedSlot] = type;
                this.toggleInventory();
            };
            inv.appendChild(slot);
        });
    }

    private togglePause(val: boolean) {
        this.isPaused = val;
        const pm = document.getElementById('pause-menu'); if (pm) pm.style.display = val ? 'flex' : 'none';
        if (val) document.exitPointerLock(); else this.renderer.domElement.requestPointerLock();
    }

    private toggleInventory() {
        if (this.isDead || this.chatActive || this.isPaused) return;
        this.inventoryOpen = !this.inventoryOpen;
        const inv = document.getElementById('inventory-gui'); if (inv) inv.style.display = this.inventoryOpen ? 'grid' : 'none';
        if (this.inventoryOpen) document.exitPointerLock(); else this.renderer.domElement.requestPointerLock();
    }

    private swingHand() {
        if (this.isSwinging) return;
        this.isSwinging = true;
        setTimeout(() => { this.isSwinging = false; }, 200);
    }

    private updateMiningTarget() {
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const hit = this.world.raycast(this.camera.position, dir, 8);
        this.miningTarget = hit ? { x: hit.x, y: hit.y, z: hit.z } : null;
        this.miningProgress = 0;
    }

    private updateActions(delta: number) {
        if (this.chatActive || this.isPaused || !this.gameStarted || this.isDead) return;
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const hit = this.world.raycast(this.camera.position, dir, 8);

        if (this.isMining) {
            if (!hit) { this.miningProgress = 0; }
            else if (!this.miningTarget || hit.x !== this.miningTarget.x || hit.y !== this.miningTarget.y || hit.z !== this.miningTarget.z) {
                this.updateMiningTarget();
            } else {
                const blockType = this.world.getBlockAt(hit.x, hit.y, hit.z);
                const hardness = BLOCK_HARDNESS[blockType] || 1.0;
                this.miningProgress += delta / hardness;
                const mp = document.getElementById('mining-progress'), mb = document.getElementById('mining-bar');
                if (mp) mp.style.display = 'block';
                if (mb) mb.style.width = (Math.min(this.miningProgress, 1) * 100) + '%';
                
                if (this.miningProgress >= 1) {
                    this.particles.spawn(new THREE.Vector3(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5), BLOCK_COLORS[blockType] || 0xffffff);
                    if (blockType === BLOCK_TYPE.TNT) {
                        this.creeperExplode(new THREE.Vector3(hit.x, hit.y, hit.z));
                    } else {
                        this.world.setBlockAt(hit.x, hit.y, hit.z, 0);
                        this.network.sendBlockUpdate(hit.x, hit.y, hit.z, 0);
                        AudioManager.playBreakSound();
                        if (this.controls.gameMode === GameMode.SURVIVAL && blockType > 0) {
                            this.inventory.set(blockType, (this.inventory.get(blockType) || 0) + 1);
                        }
                    }
                    this.updateMiningTarget();
                }
            }
        }

        if (this.isPlacing) {
            this.placeCooldown -= delta;
            if (this.placeCooldown <= 0 && hit) {
                const nx = hit.x + hit.normal.x, ny = hit.y + hit.normal.y, nz = hit.z + hit.normal.z;
                const type = this.hotbarItems[this.controls.selectedSlot] || 1;
                if (this.controls.gameMode === GameMode.SURVIVAL) {
                    const count = this.inventory.get(type) || 0;
                    if (count <= 0) return;
                    this.inventory.set(type, count - 1);
                }
                this.world.setBlockAt(nx, ny, nz, type);
                this.network.sendBlockUpdate(nx, ny, nz, type);
                AudioManager.playPlaceSound();
                this.placeCooldown = 0.25;
            }
        }
    }

    private updateSelection() {
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const hit = this.world.raycast(this.camera.position, dir, 8);
        if (hit) { this.selectionBox.visible = true; this.selectionBox.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5); }
        else this.selectionBox.visible = false;
    }

    private updateHUD() {
        if (!this.gameStarted) return;
        const uiEl = document.getElementById('ui');
        if (uiEl) uiEl.style.display = (this.isDead || this.isPaused || !this.gameStarted) ? 'none' : 'block';
        
        const hearts = document.querySelectorAll('.heart');
        hearts.forEach((h, i) => (h as HTMLElement).style.opacity = i < this.health / 2 ? '1' : '0.2');
        
        const hungers = document.querySelectorAll('.hunger');
        hungers.forEach((h, i) => (h as HTMLElement).style.opacity = i < this.hunger / 2 ? '1' : '0.2');

        const slots = document.querySelectorAll('.slot');
        slots.forEach((s, i) => {
            const el = s as HTMLElement;
            if (i === this.controls.selectedSlot) el.classList.add('active'); else el.classList.remove('active');
            const type = this.hotbarItems[i];
            const name = BLOCK_NAMES[type] || '';
            const count = this.controls.gameMode === GameMode.CREATIVE ? '∞' : String(this.inventory.get(type) || 0);
            el.innerHTML = `<span class="slot-name">${name}</span><span class="slot-count">${count}</span>`;
        });
    }

    private takeDamage(v: number) {
        if (this.controls.gameMode === GameMode.CREATIVE || this.isDead || !this.gameStarted) return;
        this.health -= v;
        AudioManager.playHitSound();
        if (this.health <= 0) { this.health = 0; this.die(); }
    }

    private die() {
        this.isDead = true;
        const ds = document.getElementById('death-screen'); if (ds) ds.style.display = 'flex';
        const ui = document.getElementById('ui'); if (ui) ui.style.display = 'none';
        document.exitPointerLock();
    }

    private savePlayerState() {
        if (this.health <= 0 || !this.gameStarted) return;
        localStorage.setItem('voxelcraft_player_state', JSON.stringify({
            pos: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z },
            health: this.health, hunger: this.hunger
        }));
    }

    private loadPlayerState() {
        const saved = localStorage.getItem('voxelcraft_player_state');
        const defaultY = this.getTerrainHeight(7.5, 7.5) + 1.8;
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.camera.position.set(data.pos.x, data.pos.y < 0 ? defaultY : data.pos.y, data.pos.z);
                this.health = data.health || 20; this.hunger = data.hunger || 20;
            } catch (_e) { this.camera.position.set(7.5, defaultY, 7.5); this.health = 20; this.hunger = 20; }
        } else { this.camera.position.set(7.5, defaultY, 7.5); this.health = 20; this.hunger = 20; }
        this.prevPos.copy(this.camera.position);
    }

    private handleResize() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    private animate = () => {
        requestAnimationFrame(this.animate);
        const delta = Math.min(this.clock.getDelta(), 0.1);
        const time = (Date.now() / 1000) % 1200;
        const angle = (time / 1200) * Math.PI * 2;
        const sunUp = Math.cos(angle);

        const skyColor = new THREE.Color(0x87CEEB);
        if (sunUp < -0.1) skyColor.set(0x0a0a1a);
        else if (sunUp < 0.1) skyColor.lerp(new THREE.Color(0xff7f50), 0.5);
        this.renderer.setClearColor(skyColor);
        if (this.scene.fog) (this.scene.fog as THREE.FogExp2).color.copy(skyColor);

        this.sun.position.set(Math.sin(angle) * 200, Math.cos(angle) * 200, 100);
        this.sun.intensity = Math.max(0, sunUp) * 1.2;
        this.moon.position.set(Math.sin(angle + Math.PI) * 200, Math.cos(angle + Math.PI) * 200, 100);
        (this.stars.material as THREE.PointsMaterial).opacity = Math.max(0, -sunUp * 2);
        this.ambientLight.intensity = Math.max(0.15, sunUp * 0.8 + 0.2);

        this.world.update(this.camera.position);

        if (this.gameStarted && !this.isDead && !this.isPaused) {
            this.controls.update(delta);
            this.updateSelection();
            this.updateActions(delta);
            this.particles.update(delta);
            this.mobs.forEach(mob => mob.update(delta, this.camera.position, () => this.takeDamage(2)));
            this.network.sendMove(this.camera.position, this.camera.rotation.y);

            // Footsteps
            if (this.controls.isLocked) {
                const horizontalDist = new THREE.Vector2(
                    this.camera.position.x - this.prevPos.x,
                    this.camera.position.z - this.prevPos.z
                ).length();
                
                // Only step if moving horizontally and not flying/jumping
                if (horizontalDist > 0.01 && !this.controls.isFlying) {
                    this.stepTimer += delta;
                    if (this.stepTimer > (this.controls.isSprinting ? 0.25 : 0.4)) {
                        AudioManager.playStepSound();
                        this.stepTimer = 0;
                    }
                } else {
                    this.stepTimer = 0;
                }
                this.prevPos.copy(this.camera.position);
            }

            // Hunger logic
            if (this.controls.gameMode === GameMode.SURVIVAL) {
                this.hungerTick += delta;
                if (this.hungerTick > 10) {
                    this.hungerTick = 0;
                    if (this.hunger > 0) this.hunger -= 0.5;
                    else this.takeDamage(1);
                }
            }

            if (this.handModel) {
                const swayX = Math.sin(Date.now() * 0.005) * 0.02, swayY = Math.cos(Date.now() * 0.005) * 0.02;
                this.handModel.position.set(0.4 + swayX, -0.3 + swayY + (this.isSwinging ? -0.1 : 0), -0.5 + (this.isSwinging ? -0.2 : 0));
                this.handModel.rotation.x = this.isSwinging ? -Math.PI / 4 : 0;
            }

            this.saveTimer += delta;
            if (this.saveTimer > 5) { this.savePlayerState(); this.saveTimer = 0; }
        }

        this.updateHUD();
        this.renderer.render(this.scene, this.camera);
    };
}
