import * as THREE from 'three';

export class TextureGenerator {
    private static canvas = document.createElement('canvas');
    private static ctx = TextureGenerator.canvas.getContext('2d')!;

    public static generateBlockTextures(): THREE.CanvasTexture {
        const S = 16;
        const A = 256;
        this.canvas.width = A;
        this.canvas.height = A;
        const ctx = this.ctx;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, A, A);

        const draw = (tx: number, ty: number, col: string, n: number) => {
            for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) {
                const c = new THREE.Color(col);
                c.offsetHSL(0, 0, (Math.random() - 0.5) * n);
                ctx.fillStyle = `#${c.getHexString()}`;
                ctx.fillRect(tx * S + i, ty * S + j, 1, 1);
            }
        };

        const drawOre = (tx: number, ty: number, oreCol: string) => {
            draw(tx, ty, '#7c7c7c', 0.12);
            const px = tx * S, py = ty * S;
            const spots = [[3,3],[7,5],[11,4],[5,10],[9,12],[13,8],[4,13],[10,2]];
            spots.forEach(([sx, sy]) => { ctx.fillStyle = oreCol; ctx.fillRect(px + sx, py + sy, 2, 2); });
        };

        const drawGrassSide = (tx: number, ty: number) => {
            draw(tx, ty, '#866043', 0.1);
            const px = tx * S, py = ty * S;
            for (let i = 0; i < S; i++) {
                const c = new THREE.Color('#4a852a'); c.offsetHSL(0, 0, (Math.random() - 0.5) * 0.1);
                ctx.fillStyle = `#${c.getHexString()}`;
                ctx.fillRect(px + i, py, 1, 1 + Math.floor(Math.random() * 2));
            }
        };

        const drawLogTop = (tx: number, ty: number) => {
            draw(tx, ty, '#967b4d', 0.08);
            const px = tx * S, py = ty * S;
            ctx.strokeStyle = '#675231'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(px + 8, py + 8, 5, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.arc(px + 8, py + 8, 2, 0, Math.PI * 2); ctx.stroke();
        };

        const drawCraftingTop = (tx: number, ty: number) => {
            draw(tx, ty, '#b8945f', 0.08);
            const px = tx * S, py = ty * S;
            ctx.fillStyle = '#6b4226';
            ctx.fillRect(px + 1, py + 1, 6, 6); ctx.fillRect(px + 9, py + 1, 6, 6);
            ctx.fillRect(px + 1, py + 9, 6, 6); ctx.fillRect(px + 9, py + 9, 6, 6);
        };

        const drawTNT = (tx: number, ty: number) => {
            draw(tx, ty, '#cc2200', 0.08);
            const px = tx * S, py = ty * S;
            ctx.fillStyle = '#222'; ctx.fillRect(px, py + 5, S, 6);
            ctx.fillStyle = '#fff'; ctx.font = '8px Arial';
            ctx.fillText('T', px + 5, py + 11);
        };

        const drawFurnace = (tx: number, ty: number) => {
            draw(tx, ty, '#888', 0.12);
            const px = tx * S, py = ty * S;
            ctx.fillStyle = '#333'; ctx.fillRect(px + 4, py + 6, 8, 8);
            ctx.fillStyle = '#ff6600'; ctx.fillRect(px + 5, py + 9, 6, 4);
        };

        const drawFlower = (tx: number, ty: number, col: string) => {
            ctx.clearRect(tx * S, ty * S, S, S);
            const px = tx * S, py = ty * S;
            // Stem
            ctx.fillStyle = '#2d6e1e';
            ctx.fillRect(px + 7, py + 6, 2, 10);
            // Petals
            ctx.fillStyle = col;
            ctx.fillRect(px + 5, py + 2, 6, 5);
            ctx.fillRect(px + 6, py + 1, 4, 7);
            // Center
            ctx.fillStyle = '#ffcc00';
            ctx.fillRect(px + 7, py + 3, 2, 2);
        };

        const drawTallGrass = (tx: number, ty: number) => {
            ctx.clearRect(tx * S, ty * S, S, S);
            const px = tx * S, py = ty * S;
            for (let i = 0; i < 5; i++) {
                const c = new THREE.Color('#5a9e3a'); c.offsetHSL(0, 0, (Math.random() - 0.5) * 0.15);
                ctx.fillStyle = `#${c.getHexString()}`;
                const bx = 2 + Math.floor(Math.random() * 10);
                ctx.fillRect(px + bx, py + 4, 2, 12);
            }
        };

        // Row 0: 0-7
        draw(0, 0, '#4a852a', 0.1);     // 0: Grass Top
        draw(1, 0, '#866043', 0.12);     // 1: Dirt
        draw(2, 0, '#7c7c7c', 0.15);    // 2: Stone
        draw(3, 0, '#675231', 0.1);      // 3: Log Side
        draw(4, 0, '#2d6e1e', 0.2);      // 4: Leaves
        draw(5, 0, '#3f76e4', 0.06);     // 5: Water
        draw(6, 0, '#ddeeff', 0.03);     // 6: Glass
        draw(7, 0, '#fdfd72', 0.12);     // 7: Glowstone

        // Row 1: 8-15
        draw(0, 1, '#b8945f', 0.08);     // 8: Planks
        draw(1, 1, '#964b33', 0.12);     // 9: Brick
        drawOre(2, 1, '#5de2e8');         // 10: Diamond Ore
        drawGrassSide(3, 1);              // 11: Grass Side
        draw(4, 1, '#dbc67b', 0.1);      // 12: Sand
        draw(5, 1, '#888888', 0.2);      // 13: Cobblestone
        drawLogTop(6, 1);                 // 14: Log Top
        drawOre(7, 1, '#222222');         // 15: Coal Ore

        // Row 2: 16-23
        drawOre(0, 2, '#d8af93');         // 16: Iron Ore
        drawOre(1, 2, '#fcee4b');         // 17: Gold Ore
        drawTNT(2, 2);                    // 18: TNT
        drawFurnace(3, 2);                // 19: Furnace
        drawCraftingTop(4, 2);            // 20: Crafting Table
        drawFlower(5, 2, '#ff2222');      // 21: Red Flower
        drawFlower(6, 2, '#ffdd00');      // 22: Yellow Flower
        drawTallGrass(7, 2);              // 23: Tall Grass

        const texture = new THREE.CanvasTexture(this.canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        return texture;
    }

    private static readonly PAD = 0.5 / 256;

    public static getUVs(type: number, isSide: boolean = false, isTop: boolean = false): number[] {
        const ts = 16 / 256;
        let tx = 0, ty = 0;

        switch (type) {
            case 1: // Grass
                if (isTop) { tx = 0; ty = 0; }
                else if (isSide) { tx = 3; ty = 1; }
                else { tx = 1; ty = 0; }
                break;
            case 2:  tx = 1; ty = 0; break;  // Dirt
            case 3:  tx = 2; ty = 0; break;  // Stone
            case 4: // Log
                if (isTop || (!isSide && !isTop)) { tx = 6; ty = 1; }
                else { tx = 3; ty = 0; }
                break;
            case 5:  tx = 4; ty = 0; break;  // Leaves
            case 6:  tx = 5; ty = 0; break;  // Water
            case 7:  tx = 6; ty = 0; break;  // Glass
            case 8:  tx = 7; ty = 0; break;  // Glowstone
            case 9:  tx = 0; ty = 1; break;  // Planks
            case 10: tx = 1; ty = 1; break;  // Brick
            case 11: // Crafting Table
                if (isTop) { tx = 4; ty = 2; }
                else { tx = 0; ty = 1; } // sides = planks
                break;
            case 12: tx = 4; ty = 1; break;  // Sand
            case 13: tx = 5; ty = 1; break;  // Cobblestone
            case 14: tx = 2; ty = 1; break;  // Diamond Ore
            case 15: tx = 7; ty = 1; break;  // Coal Ore
            case 16: tx = 0; ty = 2; break;  // Iron Ore
            case 17: tx = 1; ty = 2; break;  // Gold Ore
            case 18: tx = 2; ty = 2; break;  // TNT
            case 19: // Furnace
                if (isSide) { tx = 3; ty = 2; }
                else { tx = 2; ty = 0; } // top = stone
                break;
            case 20: tx = 5; ty = 2; break;  // Red Flower
            case 21: tx = 6; ty = 2; break;  // Yellow Flower
            case 22: tx = 7; ty = 2; break;  // Tall Grass
            default: tx = 0; ty = 0; break;
        }

        const p = this.PAD;
        const u0 = tx * ts + p, v0 = 1 - (ty + 1) * ts + p;
        const u1 = (tx + 1) * ts - p, v1 = 1 - ty * ts - p;
        return [u0, v0, u1, v0, u0, v1, u1, v1];
    }
}
