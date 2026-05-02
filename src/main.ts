import './style.css';
import { Engine } from './core/Engine';

window.addEventListener('DOMContentLoaded', () => {
    try {
        new Engine();
        console.log('VoxelCraft Engine Initialized');
    } catch (err) {
        console.error('Failed to start engine:', err);
    }
});
