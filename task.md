# 📋 VoxelCraft Development Task List

Welcome, Contributor! This file tracks the current state of the project and what needs to be done. Feel free to pick a task and start hacking!

## ✅ Completed (v0.9.0 - Current State)
- [x] Infinite procedural terrain with ores and caves.
- [x] Multi-threaded world generation (Web Workers).
- [x] Basic Mob AI (Zombies, Creepers, Skeletons, Animals).
- [x] Survival system: Health, Hunger, Fall Damage.
- [x] Procedural texture atlas generator.
- [x] Mobile/Desktop hybrid controls (Joystick support).
- [x] Retro synthesized audio system.
- [x] Creative mode inventory system.

## 🚧 High Priority (Coming Soon)
- [ ] **Greedy Meshing:** Optimize `Chunk.ts` to combine adjacent faces of the same type into a single quad. This will drastically improve FPS in complex worlds.
- [ ] **Shadow Mapping:** Add a directional shadow map for the sun to give depth to the terrain.
- [ ] **Crafting Logic:** Connect the inventory UI to a crafting recipe system.

## 🌿 Environment & Biomes
- [ ] **Water Physics:** Implement simple flowing water logic.
- [ ] **Biome Variations:** Add noise-based temperature/humidity to generate different biomes (Desert, Tundra, Forest).
- [ ] **Flora Variety:** More types of trees (Birch, Spruce) and flowers.

## 👾 Mob Improvements
- [ ] **Pathfinding:** Improve mob AI to avoid falling off cliffs or getting stuck in trees.
- [ ] **Sound variety:** Specific "hurt" sounds for different mob types.
- [ ] **Spawn Logic:** Implement night-time spawning and day-time burning for zombies/skeletons.

## 🛠️ Infrastructure
- [ ] **Persistent World:** Use `IndexedDB` to save world modifications locally so they persist after refresh.
- [ ] **Multiplayer Stability:** Refactor `server.js` to handle chunk synchronization more reliably.
- [ ] **Unit Tests:** Add tests for the noise functions and collision math.

---

### 💡 Have an idea?
If you have a feature in mind that isn't on this list, open an issue or start a discussion! We're building this for the community.
