/**
 * WORLD WORKER 9.0 - FULL MINECRAFT TERRAIN
 * All ores, flowers, tall grass, caves, trees, village houses.
 */

function hash(n: number): number {
    let x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
}

function noise2D(x: number, z: number): number {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
    const a = hash(ix + iz * 131.1), b = hash(ix + 1 + iz * 131.1);
    const c = hash(ix + (iz + 1) * 131.1), d = hash(ix + 1 + (iz + 1) * 131.1);
    return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

function fbm(x: number, z: number, octaves: number): number {
    let value = 0, amplitude = 1, frequency = 1, maxValue = 0;
    for (let i = 0; i < octaves; i++) {
        value += noise2D(x * frequency, z * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }
    return value / maxValue;
}

function noise3D(x: number, y: number, z: number): number {
    return (noise2D(x + y * 31.3, z + y * 17.7) + noise2D(y + z * 23.1, x + z * 13.3)) * 0.5;
}

self.onmessage = (e: any) => {
    try {
        const { cx, cz, worldDeltas } = e.data;
        const blocks = new Uint8Array(16 * 128 * 16);

        const setBlock = (lx: number, ly: number, lz: number, type: number) => {
            if (lx >= 0 && lx < 16 && ly >= 0 && ly < 128 && lz >= 0 && lz < 16)
                blocks[lx + lz * 16 + ly * 256] = type;
        };
        const getBlock = (lx: number, ly: number, lz: number): number => {
            if (lx < 0 || lx >= 16 || ly < 0 || ly >= 128 || lz < 0 || lz >= 16) return 0;
            return blocks[lx + lz * 16 + ly * 256];
        };

        const heightMap: number[] = new Array(256);

        for (let x = 0; x < 16; x++) {
            for (let z = 0; z < 16; z++) {
                const wx = cx * 16 + x;
                const wz = cz * 16 + z;

                // Terrain height
                const continental = fbm(wx / 200, wz / 200, 4);
                const detail = fbm(wx / 40, wz / 40, 3) * 0.3;
                const mountain = Math.pow(fbm(wx / 80, wz / 80, 4), 2) * 40;
                let height = Math.floor(continental * 30 + detail * 15 + mountain + 50);
                height = Math.max(1, Math.min(126, height));
                heightMap[x + z * 16] = height;

                // River carving
                const riverVal = Math.abs(fbm(wx / 120, wz / 120, 2) - 0.5);
                if (riverVal < 0.03) {
                    height -= Math.floor((0.03 - riverVal) * 250);
                    height = Math.max(35, height);
                    heightMap[x + z * 16] = height;
                }

                for (let y = 0; y < 128; y++) {
                    const idx = x + z * 16 + y * 256;
                    const dk = `${wx},${y},${wz}`;
                    if (worldDeltas && worldDeltas[dk] !== undefined) { blocks[idx] = worldDeltas[dk]; continue; }

                    // 3D Caves
                    if (y > 3 && y < height - 3) {
                        const cave = noise3D(wx / 15, y / 15, wz / 15);
                        if (cave > 0.7) continue;
                    }

                    if (y === 0) {
                        setBlock(x, y, z, 3); // Bedrock layer
                    } else if (y < height - 4) {
                        // Underground: Stone + Ores
                        setBlock(x, y, z, 3);
                        const oreSeed = hash(wx * 13.7 + y * 37.3 + wz * 71.1);
                        if (y < 16 && oreSeed < 0.008) setBlock(x, y, z, 14);      // Diamond (rare, deep)
                        else if (y < 32 && oreSeed < 0.015) setBlock(x, y, z, 17);  // Gold
                        else if (y < 64 && oreSeed < 0.025) setBlock(x, y, z, 16);  // Iron
                        else if (y < 80 && oreSeed < 0.04) setBlock(x, y, z, 15);   // Coal (common)
                    } else if (y < height) {
                        setBlock(x, y, z, 2); // Dirt
                    } else if (y === height) {
                        if (height < 44) setBlock(x, y, z, 12); // Sand near water
                        else setBlock(x, y, z, 1); // Grass
                    }

                    // Water fill
                    if (y <= 43 && getBlock(x, y, z) === 0) setBlock(x, y, z, 6);
                }
            }
        }

        // DECORATIONS PASS (trees, flowers, grass)
        for (let x = 2; x < 14; x++) {
            for (let z = 2; z < 14; z++) {
                const h = heightMap[x + z * 16];
                if (h <= 46) continue;
                if (getBlock(x, h, z) !== 1) continue; // Only on grass

                const wx = cx * 16 + x, wz = cz * 16 + z;
                const seed = hash(wx * 7.3 + wz * 13.7);

                // Trees (~2%)
                if (seed < 0.02) {
                    const treeH = 4 + Math.floor(hash(wx * 3.1 + wz * 5.3) * 3);
                    for (let ty = 1; ty <= treeH; ty++) setBlock(x, h + ty, z, 4);
                    for (let lx = -2; lx <= 2; lx++) {
                        for (let lz = -2; lz <= 2; lz++) {
                            for (let ly = -1; ly <= 2; ly++) {
                                if (Math.abs(lx) === 2 && Math.abs(lz) === 2 && ly < 1) continue;
                                const ty = h + treeH + ly;
                                if (ty < 128 && getBlock(x + lx, ty, z + lz) === 0) {
                                    setBlock(x + lx, ty, z + lz, 5);
                                }
                            }
                        }
                    }
                }
                // Tall grass (~8%)
                else if (seed < 0.10 && getBlock(x, h + 1, z) === 0) {
                    setBlock(x, h + 1, z, 22);
                }
                // Red flower (~1.5%)
                else if (seed < 0.115 && getBlock(x, h + 1, z) === 0) {
                    setBlock(x, h + 1, z, 20);
                }
                // Yellow flower (~1.5%)
                else if (seed < 0.13 && getBlock(x, h + 1, z) === 0) {
                    setBlock(x, h + 1, z, 21);
                }
            }
        }

        // VILLAGE HOUSES (rare, at chunk center on flat grass)
        const centerH = heightMap[8 + 8 * 16];
        if (centerH > 50 && centerH < 80) {
            const houseSeed = hash(cx * 137.7 + cz * 251.3);
            if (houseSeed < 0.03) {
                const bx = 8, bz = 8, by = centerH;
                // Floor (cobblestone)
                for (let fx = -2; fx <= 2; fx++)
                    for (let fz = -2; fz <= 2; fz++)
                        setBlock(bx + fx, by, bz + fz, 13);
                // Walls (planks) - 4 high
                for (let wy = 1; wy <= 4; wy++) {
                    for (let w = -2; w <= 2; w++) {
                        setBlock(bx - 2, by + wy, bz + w, 9);
                        setBlock(bx + 2, by + wy, bz + w, 9);
                        setBlock(bx + w, by + wy, bz - 2, 9);
                        setBlock(bx + w, by + wy, bz + 2, 9);
                    }
                }
                // Door
                setBlock(bx, by + 1, bz - 2, 0);
                setBlock(bx, by + 2, bz - 2, 0);
                // Windows
                setBlock(bx - 2, by + 2, bz, 7);  // Glass window west
                setBlock(bx + 2, by + 2, bz, 7);  // Glass window east
                // Roof
                for (let rx = -3; rx <= 3; rx++)
                    for (let rz = -3; rz <= 3; rz++)
                        setBlock(bx + rx, by + 5, bz + rz, 9);
                for (let rb = -3; rb <= 3; rb++) {
                    setBlock(bx + rb, by + 5, bz - 3, 4);
                    setBlock(bx + rb, by + 5, bz + 3, 4);
                }
                // Interior: crafting table + furnace + light
                setBlock(bx - 1, by + 1, bz + 1, 11); // Crafting table
                setBlock(bx + 1, by + 1, bz + 1, 19);  // Furnace
                setBlock(bx, by + 4, bz, 8);            // Glowstone lamp
            }
        }

        (postMessage as any)({ cx, cz, blocks }, [blocks.buffer]);
    } catch (err) { console.error("Worker error:", err); }
};
