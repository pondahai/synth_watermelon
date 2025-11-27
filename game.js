const Engine = Matter.Engine,
    Render = Matter.Render,
    Runner = Matter.Runner,
    Bodies = Matter.Bodies,
    Composite = Matter.Composite,
    Events = Matter.Events,
    World = Matter.World;

// Game Configuration
const FRUITS = [
    { label: '葡萄', radius: 15, color: '#9370DB', emoji: '🍇', score: 2 },
    { label: '櫻桃', radius: 23, color: '#FF0000', emoji: '🍒', score: 4 },
    { label: '橘子', radius: 30, color: '#FFA500', emoji: '🍊', score: 6 },
    { label: '檸檬', radius: 38, color: '#FFFF00', emoji: '🍋', score: 8 },
    { label: '奇異果', radius: 45, color: '#9ACD32', emoji: '🥝', score: 10 },
    { label: '番茄', radius: 55, color: '#FF6347', emoji: '🍅', score: 12 },
    { label: '桃子', radius: 65, color: '#FFDAB9', emoji: '🍑', score: 14 },
    { label: '鳳梨', radius: 75, color: '#FFD700', emoji: '🍍', score: 16 },
    { label: '椰子', radius: 85, color: '#8B4513', emoji: '🥥', score: 18 },
    { label: '西瓜', radius: 100, color: '#32CD32', emoji: '🍉', score: 20 },
];

const WALL_THICKNESS = 50;
const DANGER_LINE_Y = 100; // Distance from top where game over checks happen

// Game State
let score = 0;
let currentFruitIndex = 0;
let nextFruitIndex = 0;
let isGameOver = false;
let canDrop = true;
let lastMergeTime = 0;

// Setup Matter JS
const engine = Engine.create();
const world = engine.world;

// Get DOM elements
const gameArea = document.getElementById('game-area');
const scoreElement = document.getElementById('score');
const nextFruitElement = document.getElementById('next-fruit-display');
const gameOverElement = document.getElementById('game-over');
const finalScoreElement = document.getElementById('final-score');

// Create Renderer
const render = Render.create({
    element: gameArea,
    engine: engine,
    options: {
        width: gameArea.clientWidth,
        height: gameArea.clientHeight,
        wireframes: false,
        background: 'transparent'
    }
});

// Create Walls
const ground = Bodies.rectangle(
    gameArea.clientWidth / 2,
    gameArea.clientHeight + WALL_THICKNESS / 2,
    gameArea.clientWidth,
    WALL_THICKNESS,
    { isStatic: true, render: { fillStyle: '#8d6e63' } }
);

const leftWall = Bodies.rectangle(
    -WALL_THICKNESS / 2,
    gameArea.clientHeight / 2,
    WALL_THICKNESS,
    gameArea.clientHeight * 2,
    { isStatic: true, render: { fillStyle: '#8d6e63' } }
);

const rightWall = Bodies.rectangle(
    gameArea.clientWidth + WALL_THICKNESS / 2,
    gameArea.clientHeight / 2,
    WALL_THICKNESS,
    gameArea.clientHeight * 2,
    { isStatic: true, render: { fillStyle: '#8d6e63' } }
);

Composite.add(world, [ground, leftWall, rightWall]);

// Input Handling
let currentFruitBody = null;

function createCurrentFruit() {
    if (currentFruitBody) return;

    const fruitConfig = FRUITS[currentFruitIndex];
    currentFruitBody = Bodies.circle(
        gameArea.clientWidth / 2,
        50,
        fruitConfig.radius,
        {
            isStatic: true,
            label: 'current',
            render: {
                fillStyle: fruitConfig.color,
                sprite: {
                    texture: createEmojiTexture(fruitConfig.emoji, fruitConfig.radius),
                    xScale: 1,
                    yScale: 1
                }
            }
        }
    );
    Composite.add(world, currentFruitBody);
}

// Helper to create emoji texture
function createEmojiTexture(emoji, radius) {
    const c = document.createElement('canvas');
    // Increase canvas size to accommodate larger emoji
    const size = radius * 2.5;
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');

    ctx.font = `${radius * 2.2}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Draw in the center of the larger canvas
    ctx.fillText(emoji, size / 2, size / 2);

    return c.toDataURL();
}

// Mouse/Touch Events
gameArea.addEventListener('mousemove', (e) => {
    if (isGameOver || !canDrop || !currentFruitBody) return;
    const x = Math.min(Math.max(e.offsetX, 20), gameArea.clientWidth - 20);
    Matter.Body.setPosition(currentFruitBody, { x: x, y: 50 });
});

gameArea.addEventListener('click', (e) => {
    if (isGameOver || !canDrop || !currentFruitBody) return;

    canDrop = false;
    Matter.Body.setStatic(currentFruitBody, false);
    currentFruitBody.label = currentFruitIndex.toString(); // Set label to index for merging
    currentFruitBody = null;

    // Prepare next fruit
    setTimeout(() => {
        currentFruitIndex = nextFruitIndex;
        nextFruitIndex = Math.floor(Math.random() * 3); // Only small fruits spawn
        nextFruitElement.textContent = FRUITS[nextFruitIndex].emoji;
        canDrop = true;
        createCurrentFruit();
    }, 1000);
});

// Collision Handling (Merging)
function handleCollisions(event) {
    const pairs = event.pairs;

    for (let i = 0; i < pairs.length; i++) {
        const bodyA = pairs[i].bodyA;
        const bodyB = pairs[i].bodyB;

        // Check if both are fruits and same type
        if (bodyA.label === bodyB.label && bodyA.label !== 'current' && bodyA.label !== 'wall') {
            const index = parseInt(bodyA.label);

            // If not the last fruit
            if (index < FRUITS.length - 1) {
                const now = Date.now();
                // Prevent double merging in same frame
                if (now - lastMergeTime < 50) continue;
                lastMergeTime = now;

                const newX = (bodyA.position.x + bodyB.position.x) / 2;
                const newY = (bodyA.position.y + bodyB.position.y) / 2;

                World.remove(world, [bodyA, bodyB]);

                // Create new merged fruit
                const newIndex = index + 1;
                const newConfig = FRUITS[newIndex];

                const newBody = Bodies.circle(
                    newX,
                    newY,
                    newConfig.radius,
                    {
                        label: newIndex.toString(),
                        render: {
                            fillStyle: newConfig.color,
                            sprite: {
                                texture: createEmojiTexture(newConfig.emoji, newConfig.radius),
                                xScale: 1,
                                yScale: 1
                            }
                        }
                    }
                );

                Composite.add(world, newBody);

                // Update Score
                score += newConfig.score;
                scoreElement.textContent = score;
            }
        }
    }
}

Events.on(engine, 'collisionStart', handleCollisions);
Events.on(engine, 'collisionActive', handleCollisions);

// Game Over Check
Events.on(engine, 'afterUpdate', () => {
    if (isGameOver) return;

    const bodies = Composite.allBodies(world);
    for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];
        // Ignore walls and current fruit
        if (body.isStatic || body.label === 'current') continue;

        // Check if fruit is above danger line and velocity is low (stable)
        if (body.position.y < DANGER_LINE_Y && Math.abs(body.velocity.y) < 0.2) {
            if (!body.dangerTimer) {
                body.dangerTimer = Date.now();
            } else if (Date.now() - body.dangerTimer > 2000) {
                endGame();
            }
        } else {
            body.dangerTimer = null;
        }
    }
});

function endGame() {
    isGameOver = true;
    gameOverElement.classList.remove('hidden');
    finalScoreElement.textContent = score;
    Runner.stop(runner);
}

// Start Game
createCurrentFruit();
nextFruitIndex = Math.floor(Math.random() * 3);
nextFruitElement.textContent = FRUITS[nextFruitIndex].emoji;

const runner = Runner.create();
Runner.run(runner, engine);
Render.run(render);

// Handle Resize
window.addEventListener('resize', () => {
    render.canvas.width = gameArea.clientWidth;
    render.canvas.height = gameArea.clientHeight;

    // Reposition walls
    Matter.Body.setPosition(ground, { x: gameArea.clientWidth / 2, y: gameArea.clientHeight + WALL_THICKNESS / 2 });
    Matter.Body.setPosition(rightWall, { x: gameArea.clientWidth + WALL_THICKNESS / 2, y: gameArea.clientHeight / 2 });
});
