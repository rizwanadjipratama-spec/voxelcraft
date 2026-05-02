import * as THREE from 'three';
import { WORLD, BLOCK_TYPE } from './Constants';
import { TextureGenerator } from './TextureGenerator';

let blockTextureAtlas: THREE.Texture | null = null;
try {
    blockTextureAtlas = TextureGenerator.generateBlockTextures();
} catch (e) {
    console.error("Texture Atlas Generation Failed!", e);
}

export class Chunk {
    public x: number;
    public z: number;
    private scene: THREE.Scene;
    public data: Uint8Array;
    public mesh: THREE.Mesh | null = null;

    constructor(x: number, z: number, scene: THREE.Scene) {
        this.x = x;
        this.z = z;
        this.scene = scene;
        this.data = new Uint8Array(16 * 128 * 16);
    }

    public setBlock(lx: number, ly: number, lz: number, type: BLOCK_TYPE) {
        if (lx < 0 || lx >= 16 || lz < 0 || lz >= 16 || ly < 0 || ly >= 128) return;
        this.data[lx + (lz * 16) + (ly * 256)] = type;
    }

    public getBlock(lx: number, ly: number, lz: number): number {
        if (lx < 0 || lx >= 16 || lz < 0 || lz >= 16 || ly < 0 || ly >= 128) return 0;
        return this.data[lx + (lz * 16) + (ly * 256)];
    }

    public dispose() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            if (Array.isArray(this.mesh.material)) (this.mesh.material as THREE.Material[]).forEach(m => m.dispose());
            else (this.mesh.material as THREE.Material).dispose();
            this.mesh = null;
        }
    }

    public generateMesh() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
        }

        const vertices: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];
        const colors: number[] = [];
        const indices: number[] = [];
        let indexCount = 0;

        const addFace = (x: number, y: number, z: number, type: number, nx: number, ny: number, nz: number, faceVertices: number[], isSide: boolean, isTop: boolean) => {
            const blockUVs = TextureGenerator.getUVs(type, isSide, isTop);
            const aoColors = this.calculateAO(x, y, z, nx, ny, nz);
            
            for (let i = 0; i < 4; i++) {
                vertices.push(x + faceVertices[i * 3], y + faceVertices[i * 3 + 1], z + faceVertices[i * 3 + 2]);
                normals.push(nx, ny, nz);
                colors.push(aoColors[i], aoColors[i], aoColors[i]);
            }
            uvs.push(blockUVs[0], blockUVs[1], blockUVs[2], blockUVs[3], blockUVs[4], blockUVs[5], blockUVs[6], blockUVs[7]);
            indices.push(indexCount, indexCount + 2, indexCount + 1, indexCount + 1, indexCount + 2, indexCount + 3);
            indexCount += 4;
        };

        for (let x = 0; x < 16; x++) {
            for (let y = 0; y < 128; y++) {
                for (let z = 0; z < 16; z++) {
                    const type = this.getBlock(x, y, z);
                    if (type === 0) continue;

                    const isSolid = (dx: number, dy: number, dz: number) => {
                        const b = this.getBlock(x + dx, y + dy, z + dz);
                        if (x+dx < 0 || x+dx >= 16 || z+dz < 0 || z+dz >= 16) return false;
                        // Transparent blocks: air, water, glass, leaves, flowers, tall grass
                        return b !== 0 && b !== 6 && b !== 7 && b !== 5 && b !== 20 && b !== 21 && b !== 22;
                    };

                    if (!isSolid(0, 1, 0)) addFace(x, y, z, type, 0, 1, 0, [0,1,1, 1,1,1, 0,1,0, 1,1,0], false, true);
                    if (!isSolid(0, -1, 0)) addFace(x, y, z, type, 0, -1, 0, [0,0,0, 1,0,0, 0,0,1, 1,0,1], false, false);
                    if (!isSolid(-1, 0, 0)) addFace(x, y, z, type, -1, 0, 0, [0,0,0, 0,0,1, 0,1,0, 0,1,1], true, false);
                    if (!isSolid(1, 0, 0)) addFace(x, y, z, type, 1, 0, 0, [1,0,1, 1,0,0, 1,1,1, 1,1,0], true, false);
                    if (!isSolid(0, 0, -1)) addFace(x, y, z, type, 0, 0, -1, [1,0,0, 0,0,0, 1,1,0, 0,1,0], true, false);
                    if (!isSolid(0, 0, 1)) addFace(x, y, z, type, 0, 0, 1, [0,0,1, 1,0,1, 0,1,1, 1,1,1], true, false);
                }
            }
        }

        if (vertices.length === 0) return; // DON'T RENDER EMPTY CHUNKS

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(indices);

        const material = new THREE.MeshStandardMaterial({ 
            map: blockTextureAtlas,
            vertexColors: true, 
            transparent: false,
            side: THREE.DoubleSide,
            roughness: 1.0, // ENSURE BLOCKS LOOK SOLID
            metalness: 0.0
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(this.x * 16, 0, this.z * 16);
        this.scene.add(this.mesh);
    }

    private calculateAO(x: number, y: number, z: number, nx: number, ny: number, nz: number): number[] {
        const res = [1, 1, 1, 1];
        const check = (dx: number, dy: number, dz: number) => (this.getBlock(x + dx, y + dy, z + dz) !== 0) ? 0.25 : 0;
        if (ny === 1) {
            res[0] -= (check(-1, 1, 1) + check(-1, 1, 0) + check(0, 1, 1));
            res[1] -= (check(1, 1, 1) + check(1, 1, 0) + check(0, 1, 1));
            res[2] -= (check(-1, 1, -1) + check(-1, 1, 0) + check(0, 1, -1));
            res[3] -= (check(1, 1, -1) + check(1, 1, 0) + check(0, 1, -1));
        }
        return res.map(v => Math.max(0.4, v));
    }
}
