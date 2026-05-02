import { io, Socket } from 'socket.io-client';
import * as THREE from 'three';
import { World } from '../world/World';

export class NetworkManager {
    private socket: Socket | null = null;
    private otherPlayers: Map<string, THREE.Group> = new Map();
    private scene: THREE.Scene;
    private world: World;
    public onChatMessage: ((msg: string) => void) | null = null;

    constructor(scene: THREE.Scene, world: World) {
        this.scene = scene;
        this.world = world;
    }

    public connect(url: string) {
        if (this.socket) this.socket.disconnect();
        const statusEl = document.getElementById('mp-status');
        if (statusEl) { statusEl.innerText = 'CONNECTING...'; statusEl.style.color = '#ffff55'; }

        this.socket = io(url, { reconnection: true });

        this.socket.on('connect', () => {
            if (statusEl) { statusEl.innerText = 'CONNECTED'; statusEl.style.color = '#55ff55'; }
        });

        this.socket.on('init', (data) => {
            for (const id in data.players) {
                if (id !== this.socket?.id) this.addPlayer(id, data.players[id].pos);
            }
        });

        this.socket.on('chatMessage', (data) => {
            this.onChatMessage?.(`${data.id.substring(0,4)}: ${data.msg}`);
        });

        this.socket.on('playerJoin', (data) => this.addPlayer(data.id, {x:7.5, y:60, z:7.5}));

        this.socket.on('playerMove', (data) => {
            const player = this.otherPlayers.get(data.id);
            if (player) {
                player.position.lerp(new THREE.Vector3(data.pos.x, data.pos.y, data.pos.z), 0.3);
                player.rotation.y = data.rot;
            }
        });

        this.socket.on('blockUpdate', (data) => {
            this.world.setBlockAt(data.x, data.y, data.z, data.type);
        });

        this.socket.on('playerLeave', (id) => {
            const player = this.otherPlayers.get(id);
            if (player) { this.scene.remove(player); this.otherPlayers.delete(id); }
        });

        this.socket.on('disconnect', () => {
            if (statusEl) { statusEl.innerText = 'DISCONNECTED'; statusEl.style.color = '#ff5555'; }
        });
    }

    public sendChat(msg: string) {
        this.socket?.emit('chatMessage', msg);
    }

    private addPlayer(id: string, pos: any) {
        if (this.otherPlayers.has(id)) return;
        const group = new THREE.Group();
        
        // Body
        const bodyGeo = new THREE.BoxGeometry(0.6, 1.2, 0.4);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x5555ff });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.6;
        group.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xdbac83 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.45;
        group.add(head);

        // Arms
        const armGeo = new THREE.BoxGeometry(0.2, 1.0, 0.2);
        const armL = new THREE.Mesh(armGeo, bodyMat);
        armL.position.set(-0.4, 0.6, 0);
        group.add(armL);
        const armR = new THREE.Mesh(armGeo, bodyMat);
        armR.position.set(0.4, 0.6, 0);
        group.add(armR);

        group.position.set(pos.x, pos.y, pos.z);
        this.scene.add(group);
        this.otherPlayers.set(id, group);
    }

    public sendMove(pos: THREE.Vector3, rot: number) {
        this.socket?.emit('move', { pos: { x: pos.x, y: pos.y, z: pos.z }, rot });
    }

    public sendBlockUpdate(x: number, y: number, z: number, type: number) {
        this.socket?.emit('blockUpdate', { x, y, z, type });
    }
}
