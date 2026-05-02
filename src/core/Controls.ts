import * as THREE from 'three';
import { World } from '../world/World';
import { createNoise2D } from 'simplex-noise';

export enum GameMode { SURVIVAL, CREATIVE }

export class Controls {
    public camera: THREE.PerspectiveCamera;
    private domElement: HTMLElement;
    private world: World;
    private noise2D = createNoise2D();
    
    public isLocked: boolean = false;
    private keys: Set<string> = new Set();
    private velocity: THREE.Vector3 = new THREE.Vector3();
    private canJump: boolean = false;
    
    public gameMode: GameMode = GameMode.SURVIVAL;
    public isFlying: boolean = false;
    public isSneaking: boolean = false;
    public isSprinting: boolean = false;
    private lastSpaceTime: number = 0;
    
    private onBlockAction: ((data: any) => void) | null = null;
    public selectedSlot: number = 0;
    public sensitivity: number = 1.0;
    private bobTime: number = 0;
    private lastY: number = 0;
    private fallStart: number = 0;
    private onFall: ((dist: number) => void) | null = null;
    public setOnFall(cb: (dist: number) => void) { this.onFall = cb; }

    constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement, world: World) {
        this.camera = camera;
        this.domElement = domElement;
        this.world = world;
        this.camera.rotation.order = 'YXZ';
        this.initEventListeners();
        this.initMobileControls();
    }

    private initMobileControls() {
        const joystickBase = document.getElementById('joystick-base'), knob = document.getElementById('joystick-knob');
        if (!joystickBase || !knob) return;
        const handleTouch = (e: TouchEvent) => {
            const touch = e.touches[0], rect = joystickBase.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2, centerY = rect.top + rect.height / 2;
            const dx = touch.clientX - centerX, dy = touch.clientY - centerY;
            const dist = Math.min(Math.sqrt(dx * dx + dy * dy), rect.width / 2), angle = Math.atan2(dy, dx);
            knob.style.transform = `translate(calc(-50% + ${Math.cos(angle)*dist}px), calc(-50% + ${Math.sin(angle)*dist}px))`;
        };
        joystickBase.addEventListener('touchstart', (e) => handleTouch(e));
        joystickBase.addEventListener('touchmove', (e) => { e.preventDefault(); handleTouch(e); }, { passive: false });
        joystickBase.addEventListener('touchend', () => { knob.style.transform = 'translate(-50%, -50%)'; });
        document.getElementById('btn-jump')?.addEventListener('touchstart', (e) => { e.preventDefault(); this.keys.add('Space'); });
        document.getElementById('btn-jump')?.addEventListener('touchend', () => this.keys.delete('Space'));
        document.getElementById('btn-place')?.addEventListener('touchstart', (e) => { e.preventDefault(); this.onBlockAction?.('start-place'); setTimeout(() => this.onBlockAction?.('stop-place'), 100); });
        document.getElementById('btn-inv')?.addEventListener('touchstart', (e) => { e.preventDefault(); this.onBlockAction?.('inventory'); });
    }

    private initEventListeners() {
        document.addEventListener('keydown', (e) => {
            this.keys.add(e.code);
            if (e.code === 'KeyE') this.onBlockAction?.('inventory');
            if (e.code === 'Space') { const now = performance.now(); if (now - this.lastSpaceTime < 250 && this.gameMode === GameMode.CREATIVE) this.isFlying = !this.isFlying; this.lastSpaceTime = now; }
            if (e.code.startsWith('Digit')) { const d = parseInt(e.code.replace('Digit', '')) - 1; if (d >= 0 && d <= 8) this.selectedSlot = d; }
        });
        document.addEventListener('keyup', (e) => this.keys.delete(e.code));
        
        // MOUSE INTERACTION (LEFT/RIGHT/SCROLL)
        document.addEventListener('mousedown', (e) => {
            if (!this.isLocked) return;
            if (e.button === 0) this.onBlockAction?.('start-break'); // LEFT CLICK
            if (e.button === 2) this.onBlockAction?.('start-place'); // RIGHT CLICK
        });
        document.addEventListener('mouseup', (e) => { if (e.button === 0) this.onBlockAction?.('stop-break'); if (e.button === 2) this.onBlockAction?.('stop-place'); });
        
        document.addEventListener('wheel', (e) => {
            if (!this.isLocked) return;
            this.selectedSlot = (this.selectedSlot + (e.deltaY > 0 ? 1 : -1) + 9) % 9;
        });

        document.addEventListener('pointerlockchange', () => { this.isLocked = document.pointerLockElement === this.domElement; });
        document.addEventListener('mousemove', (e) => {
            if (!this.isLocked) return;
            this.camera.rotation.y -= e.movementX * 0.002 * this.sensitivity;
            this.camera.rotation.x -= e.movementY * 0.002 * this.sensitivity;
            this.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.rotation.x));
        });
        document.addEventListener('contextmenu', (e) => e.preventDefault()); // Disable context menu for right-click placing
    }

    public setOnBlockAction(callback: (type: any) => void) { this.onBlockAction = callback; }

    public update(delta: number) {
        this.applyTick(delta);
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

    private applyTick(d: number) {
        this.isSprinting = this.keys.has('ControlLeft');
        this.isSneaking = this.keys.has('ShiftLeft') && !this.isFlying;
        let speed = (this.isSprinting ? 5.612 : (this.isSneaking ? 1.295 : 4.317)) * d;
        if (this.isFlying) speed *= 2.5;
        const moveDir = new THREE.Vector3();
        if (this.keys.has('KeyW')) moveDir.z += 1; if (this.keys.has('KeyS')) moveDir.z -= 1;
        if (this.keys.has('KeyA')) moveDir.x -= 1; if (this.keys.has('KeyD')) moveDir.x += 1;
        if (moveDir.length() > 0) moveDir.normalize();
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion); forward.y = 0; forward.normalize();
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion); right.y = 0; right.normalize();
        this.velocity.x = (forward.x * moveDir.z + right.x * moveDir.x) * speed;
        this.velocity.z = (forward.z * moveDir.z + right.z * moveDir.x) * speed;
        if (this.isFlying) {
            if (this.keys.has('Space')) this.velocity.y = speed * 2.0; else if (this.keys.has('ShiftLeft')) this.velocity.y = -speed * 2.0; else this.velocity.y *= 0.6;
            this.fallStart = this.camera.position.y;
        } else {
            if (this.keys.has('Space') && this.canJump) { this.velocity.y = 0.52; this.canJump = false; }
            this.velocity.y -= 0.08; this.velocity.y *= 0.98;
            if (this.velocity.y > -0.1) this.fallStart = this.camera.position.y;
        }
        this.applyStep();
        this.applyBob(d);
    }

    private applyBob(d: number) {
        if (this.isFlying || !this.canJump) return;
        const speed = new THREE.Vector2(this.velocity.x, this.velocity.z).length();
        if (speed > 0.01) {
            this.bobTime += d * (this.isSprinting ? 15 : 10);
            this.camera.position.y += Math.sin(this.bobTime) * 0.05;
        }
    }

    private applyStep() {
        const pos = this.camera.position;
        pos.y += this.velocity.y;
        const terrainY = this.getTerrainHeight(pos.x, pos.z) + 1.8;
        if (this.world.chunks.size < 2 && pos.y < terrainY) { pos.y = terrainY; this.velocity.y = 0; this.canJump = true; return; }
        if (this.checkCollision(pos.x, pos.y, pos.z)) { 
            if (this.velocity.y < 0) { 
                const fallDist = this.fallStart - pos.y;
                if (fallDist > 3.5 && this.onFall) this.onFall(fallDist);
                this.canJump = true; 
                pos.y = Math.ceil(pos.y-1.8)+1.8; 
            } 
            else { pos.y = Math.floor(pos.y)-0.001; }
            this.velocity.y = 0; 
        }
        const nx = pos.x + this.velocity.x; const nz = pos.z + this.velocity.z;
        if (this.checkCollision(nx, pos.y, nz)) {
            const canStepUp = !this.isFlying && !this.checkCollision(nx, pos.y + 1.1, nz) && !this.checkCollision(nx, pos.y + 2.1, nz);
            if (canStepUp) { pos.y += 1.05; pos.x = nx; pos.z = nz; }
            else { this.velocity.x = 0; this.velocity.z = 0; }
        } else { pos.x = nx; pos.z = nz; }
    }

    private checkCollision(px: number, py: number, pz: number): boolean {
        const r = 0.3, h = 1.8;
        for (let x = Math.floor(px-r); x <= Math.floor(px+r); x++) {
            for (let y = Math.floor(py-h); y <= Math.floor(py); y++) {
                for (let z = Math.floor(pz-r); z <= Math.floor(pz+r); z++) {
                    const b = this.world.getBlockAt(x, y, z); if (b !== 0 && b !== 6) return true;
                }
            }
        }
        return false;
    }
}
