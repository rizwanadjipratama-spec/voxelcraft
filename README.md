# 🧱 VoxelCraft: Browser-Based Voxel Engine

VoxelCraft is a technical demonstration of a Minecraft-inspired engine built using **TypeScript** and **Three.js**. The goal of this project is to explore how complex voxel environments, mob AI, and survival mechanics can be implemented efficiently in a web browser using modern web technologies like **Web Workers** and **Socket.io**.

This project is a work in progress and is intentionally kept open-source for learning and community collaboration.

---

## 🛠️ Features (What it can do)

*   **Procedural World Generation:** Uses FBM noise to create infinite terrain, including mountains, rivers, and caves.
*   **Off-Main-Thread Processing:** All terrain calculations are handled by Web Workers to prevent lag during world exploration.
*   **Basic Mob AI:** Simple implementations of aggressive (Skeletons, Creepers, Zombies) and passive (Pigs, Cows) mobs.
*   **Survival Mechanics:** A basic health and hunger system, fall damage, and item collection.
*   **Creative Mode:** A mode for free-building with a library of various block types.
*   **Multiplayer Capability:** Includes a basic Socket.io server for real-time player synchronization (experimental).
*   **Procedural Textures:** All block textures are generated on-the-fly using the Canvas API, keeping the project lightweight.

---

## 🚀 Getting Started (How to Install)

To run this project on your local machine, follow these steps:

### Prerequisites
*   [Node.js](https://nodejs.org/) (LTS version recommended)
*   npm (comes with Node.js)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
    cd YOUR_REPO_NAME
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Start the development server:**
    ```bash
    npm run dev
    ```
    The game should now be running at `http://localhost:5173`.

4.  **Running the Multiplayer Server (Optional):**
    If you want to test the multiplayer features, open a new terminal and run:
    ```bash
    node server.js
    ```

---

## 📂 Understanding the Code

If you want to contribute or learn from the code, here is a quick guide to the important files:

*   **`src/core/Engine.ts`**: The main entry point that handles the game loop and orchestrates all systems.
*   **`src/core/Controls.ts`**: Handles the physics and player movement (including mobile joystick).
*   **`src/world/world.worker.ts`**: The code that generates the terrain on a separate thread.
*   **`src/world/Chunk.ts`**: Responsible for converting block data into 3D meshes that the browser can render.
*   **`src/world/TextureGenerator.ts`**: Generates the "look" of the blocks without needing external image files.

---

## 🤝 Contributing

This project is far from perfect, and there are many areas for improvement (lighting, crafting, biome variety, etc.). If you have ideas or fixes, feel free to open a Pull Request. We value neutral, clean, and well-documented code.

---

## 📜 License
Distributed under the MIT License. See `LICENSE` for more information.
