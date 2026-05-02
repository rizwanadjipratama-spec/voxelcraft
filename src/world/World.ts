import * as THREE from 'three';
import { Chunk } from './Chunk';

export class World {
    public chunks: Map<string, Chunk> = new Map();
    private scene: THREE.Scene;
    public renderDistance = 4;
    private lastPlayerChunk = { x: -999, z: -999 };
    private worldDeltas: Map<string, number> = new Map();
    private worker: Worker | null = null;
    
    private chunkQueue: { cx: number, cz: number, dist: number }[] = [];
    private isProcessingQueue = false;
    private pendingChunks: Set<string> = new Set(); // TRACK PENDING WORKER REQUESTS

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.loadWorldDeltas();
        
        try {
            this.worker = new Worker(new URL('./world.worker.ts', import.meta.url), { type: 'module' });
            this.worker.onmessage = (e) => {
                const { cx, cz, blocks } = e.data;
                this.finalizeChunk(cx, cz, blocks);
                this.isProcessingQueue = false;
                this.processQueue();
            };
            this.worker.onerror = (err) => {
                console.error("WORLD WORKER ERROR:", err);
                this.fallbackGenerate(0, 0); 
            };
        } catch (e) {
            console.error("Worker Boot Failed!", e);
        }
    }

    private fallbackGenerate(cx: number, cz: number) {
        const blocks = new Uint8Array(16 * 128 * 16);
        for(let x=0; x<16; x++) {
            for(let z=0; z<16; z++) {
                for(let y=0; y<60; y++) {
                    const idx = x + (z * 16) + (y * 256);
                    blocks[idx] = (y > 58) ? 1 : 2;
                }
            }
        }
        this.finalizeChunk(cx, cz, blocks);
    }

    private loadWorldDeltas() {
        const saved = localStorage.getItem('voxelcraft_world_deltas');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                for (const key in data) this.worldDeltas.set(key, data[key]);
            } catch(e) { localStorage.removeItem('voxelcraft_world_deltas'); }
        }
    }

    private saveWorldDeltas() {
        const data: any = {};
        this.worldDeltas.forEach((val, key) => data[key] = val);
        localStorage.setItem('voxelcraft_world_deltas', JSON.stringify(data));
    }

    public update(playerPosition: THREE.Vector3) {
        const cx = Math.floor(playerPosition.x / 16);
        const cz = Math.floor(playerPosition.z / 16);
        if (cx !== this.lastPlayerChunk.x || cz !== this.lastPlayerChunk.z) {
            this.lastPlayerChunk = { x: cx, z: cz };
            this.updateStreamingQueue(cx, cz);
            this.unloadFarChunks(cx, cz);
        }
    }

    private updateStreamingQueue(pcx: number, pcz: number) {
        const newQueue = [];
        for (let x = -this.renderDistance; x <= this.renderDistance; x++) {
            for (let z = -this.renderDistance; z <= this.renderDistance; z++) {
                const cx = pcx + x;
                const cz = pcz + z;
                const key = `${cx},${cz}`;
                if (!this.chunks.has(key) && !this.pendingChunks.has(key)) {
                    const dist = Math.sqrt(x * x + z * z);
                    newQueue.push({ cx, cz, dist });
                }
            }
        }
        newQueue.sort((a, b) => a.dist - b.dist);
        this.chunkQueue = [...newQueue, ...this.chunkQueue]; // PREPEND NEW CHUNKS
        this.processQueue();
    }

    private processQueue() {
        if (this.isProcessingQueue || this.chunkQueue.length === 0) return;
        
        const { cx, cz } = this.chunkQueue.shift()!;
        const key = `${cx},${cz}`;
        if (this.chunks.has(key)) { this.processQueue(); return; }

        this.isProcessingQueue = true;
        this.pendingChunks.add(key);
        
        const deltasObj: any = {};
        this.worldDeltas.forEach((v, k) => {
            const [wx, , wz] = k.split(',').map(Number);
            if (Math.floor(wx/16) === cx && Math.floor(wz/16) === cz) deltasObj[k] = v;
        });

        if (this.worker) {
            this.worker.postMessage({ cx, cz, worldDeltas: deltasObj });
        } else {
            this.fallbackGenerate(cx, cz);
            this.isProcessingQueue = false;
            this.processQueue();
        }
    }

    private unloadFarChunks(cx: number, cz: number) {
        const threshold = this.renderDistance + 2;
        for (const [key, chunk] of this.chunks) {
            if (Math.abs(chunk.x - cx) > threshold || Math.abs(chunk.z - cz) > threshold) {
                chunk.dispose();
                this.chunks.delete(key);
            }
        }
        // Also clean pending set
        this.pendingChunks.forEach(key => {
            const [px, pz] = key.split(',').map(Number);
            if (Math.abs(px - cx) > threshold || Math.abs(pz - cz) > threshold) {
                this.pendingChunks.delete(key);
            }
        });
    }

    private finalizeChunk(cx: number, cz: number, blocks: Uint8Array) {
        const key = `${cx},${cz}`;
        this.pendingChunks.delete(key);
        
        // CREATE CHUNK ONLY ONCE WHEN DATA ARRIVES
        if (!this.chunks.has(key)) {
            const chunk = new Chunk(cx, cz, this.scene);
            chunk.data = blocks;
            chunk.generateMesh();
            this.chunks.set(key, chunk);
        }
    }

    public getBlockAt(x: number, y: number, z: number): number {
        const cx = Math.floor(x / 16); const cz = Math.floor(z / 16);
        const lx = ((x % 16) + 16) % 16; const lz = ((z % 16) + 16) % 16;
        const chunk = this.chunks.get(`${cx},${cz}`);
        return chunk ? chunk.getBlock(lx, Math.floor(y), lz) : 0;
    }

    public setBlockAt(x: number, y: number, z: number, type: number) {
        const cx = Math.floor(x / 16); const cz = Math.floor(z / 16);
        const lx = ((x % 16) + 16) % 16; const lz = ((z % 16) + 16) % 16;
        const chunk = this.chunks.get(`${cx},${cz}`);
        if (chunk) {
            chunk.setBlock(lx, Math.floor(y), lz, type);
            this.worldDeltas.set(`${x},${Math.floor(y)},${z}`, type);
            this.saveWorldDeltas();
            chunk.generateMesh();
        }
    }

    public raycast(origin: THREE.Vector3, direction: THREE.Vector3, reach: number) {
        const step = 0.1;
        for (let i = 0; i < reach; i += step) {
            const p = origin.clone().add(direction.clone().multiplyScalar(i));
            const x = Math.floor(p.x); const y = Math.floor(p.y); const z = Math.floor(p.z);
            const block = this.getBlockAt(x, y, z);
            if (block !== 0 && block !== 6) {
                const prevP = origin.clone().add(direction.clone().multiplyScalar(i - step));
                const normal = new THREE.Vector3(Math.floor(p.x) - Math.floor(prevP.x), Math.floor(p.y) - Math.floor(prevP.y), Math.floor(p.z) - Math.floor(prevP.z)).normalize();
                return { x, y, z, block, normal };
            }
        }
        return null;
    }
}
