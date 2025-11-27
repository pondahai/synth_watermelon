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

    // Use pre-calculated vertices if available, otherwise fallback to circle
    let body;
    if (fruitConfig.vertices && fruitConfig.vertices.length > 0) {
        body = Bodies.fromVertices(
            gameArea.clientWidth / 2,
            50,
            fruitConfig.vertices,
            {
                isStatic: true,
                label: 'current',
                render: {
                    visible: false  // Don't render the body itself, only our custom emoji
                }
            },
            false,
            0.01,
            0.0001
        );

        // If body creation failed (e.g. too small), fallback to circle
        if (!body) {
            body = Bodies.circle(gameArea.clientWidth / 2, 50, fruitConfig.radius, {
                isStatic: true,
                label: 'current',
                render: { visible: false }
            });
        } else {
            // Remove sprite from child parts to prevent duplicates
            // Keep fillStyle so the body still has collision shapes visible
            if (body.parts && body.parts.length > 1) {
                for (let i = 1; i < body.parts.length; i++) {
                    if (body.parts[i].render.sprite) {
                        body.parts[i].render.sprite = null;
                    }
                    // Set label on all parts for collision detection
                    body.parts[i].label = 'current';
                }
            }
        }
    } else {
        console.log(`[CREATE] No vertices for ${fruitConfig.emoji}, using circle`);
        body = Bodies.circle(
            gameArea.clientWidth / 2,
            50,
            fruitConfig.radius,
            {
                isStatic: true,
                label: 'current',
                render: { visible: false }
            }
        );
    }

    currentFruitBody = body;
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

    // Also set label on all parts if it's a compound body
    if (currentFruitBody.parts && currentFruitBody.parts.length > 1) {
        for (let i = 0; i < currentFruitBody.parts.length; i++) {
            currentFruitBody.parts[i].label = currentFruitIndex.toString();
        }
    }

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
    const mergedBodies = new Set(); // Track bodies merged in this event

    for (let i = 0; i < pairs.length; i++) {
        const bodyA = pairs[i].bodyA;
        const bodyB = pairs[i].bodyB;

        // Skip if either body has already been merged in this event
        if (mergedBodies.has(bodyA.id) || mergedBodies.has(bodyB.id)) continue;

        // Check if both are fruits and same type
        if (bodyA.label === bodyB.label && bodyA.label !== 'current' && bodyA.label !== 'wall') {
            const index = parseInt(bodyA.label);

            // If not the last fruit
            if (index < FRUITS.length - 1) {
                const now = Date.now();
                // Prevent double merging in same frame - increased cooldown
                if (now - lastMergeTime < 100) continue;
                lastMergeTime = now;

                // Mark these bodies as merged
                mergedBodies.add(bodyA.id);
                mergedBodies.add(bodyB.id);

                // Get parent bodies if these are parts of a compound body
                const parentA = bodyA.parent === bodyA ? bodyA : bodyA.parent;
                const parentB = bodyB.parent === bodyB ? bodyB : bodyB.parent;

                const newX = (parentA.position.x + parentB.position.x) / 2;
                const newY = (parentA.position.y + parentB.position.y) / 2;

                // Remove parent bodies, not parts
                World.remove(world, [parentA, parentB]);

                // Create new merged fruit
                const newIndex = index + 1;
                const newConfig = FRUITS[newIndex];

                let newBody;
                if (newConfig.vertices && newConfig.vertices.length > 0) {
                    newBody = Bodies.fromVertices(
                        newX,
                        newY,
                        newConfig.vertices,
                        {
                            label: newIndex.toString(),
                            render: { visible: false }
                        },
                        false,
                        0.01,
                        0.0001
                    );
                    if (!newBody) {
                        newBody = Bodies.circle(newX, newY, newConfig.radius, {
                            label: newIndex.toString(),
                            render: { visible: false }
                        });
                    } else {
                        // Remove sprite from child parts to prevent duplicates
                        if (newBody.parts && newBody.parts.length > 1) {
                            for (let i = 1; i < newBody.parts.length; i++) {
                                if (newBody.parts[i].render.sprite) {
                                    newBody.parts[i].render.sprite = null;
                                }
                                // Set label on all parts for collision detection
                                newBody.parts[i].label = newIndex.toString();
                            }
                        }
                    }
                } else {
                    newBody = Bodies.circle(
                        newX,
                        newY,
                        newConfig.radius,
                        {
                            label: newIndex.toString(),
                            render: { visible: false }
                        }
                    );
                }

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
// Pre-calculate vertices for all fruits
FRUITS.forEach(fruit => {
    fruit.vertices = generateEmojiVertices(fruit.emoji, fruit.radius);
});

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

// Custom rendering: Draw emojis
Events.on(render, 'afterRender', function () {
    const ctx = render.context;
    const bodies = Composite.allBodies(engine.world);

    // Draw emojis manually
    ctx.font = '30px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];

        // Skip walls
        if (body.isStatic && body.label !== 'current') continue;

        // Get fruit config from label
        const fruitIndex = body.label === 'current' ? currentFruitIndex : parseInt(body.label);
        if (isNaN(fruitIndex) || fruitIndex < 0 || fruitIndex >= FRUITS.length) continue;

        const fruitConfig = FRUITS[fruitIndex];

        // Draw emoji at body position
        ctx.save();
        ctx.translate(body.position.x, body.position.y);
        ctx.rotate(body.angle);
        ctx.font = `${fruitConfig.radius * 2}px Arial`;
        ctx.fillText(fruitConfig.emoji, 0, 0);
        ctx.restore();
    }

    // Uncomment below to show collision outlines for debugging
    /*
    ctx.beginPath();
    for (let i = 0; i < bodies.length; i += 1) {
        const body = bodies[i];
        if (body.isStatic && body.label !== 'current') continue;

        const vertices = body.vertices;

        ctx.moveTo(vertices[0].x, vertices[0].y);
        for (let j = 1; j < vertices.length; j += 1) {
            ctx.lineTo(vertices[j].x, vertices[j].y);
        }
        ctx.lineTo(vertices[0].x, vertices[0].y);
    }
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#FF0000';
    ctx.stroke();
    */
});

// Vertex Generation Logic

function generateEmojiVertices(emoji, radius) {
    const size = radius * 2.5;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.font = `${radius * 2.2}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, size / 2, size / 2);

    const imageData = ctx.getImageData(0, 0, size, size);
    const data = imageData.data;
    const width = size;
    const height = size;

    // Helper to check if pixel is solid
    const threshold = 50; // Lowered threshold to catch more pixels
    const isSolid = (x, y) => {
        if (x < 0 || x >= width || y < 0 || y >= height) return false;
        return data[(y * width + x) * 4 + 3] > threshold;
    };

    // Find topmost solid pixel
    let startX = -1, startY = -1;
    outerLoop:
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (isSolid(x, y)) {
                startX = x;
                startY = y;
                break outerLoop;
            }
        }
    }

    if (startX === -1) {
        console.warn(`No solid pixels found for ${emoji}`);
        return null;
    }

    // Trace boundary clockwise (Moore neighborhood)
    const points = [];
    const dirs = [
        [1, 0],   // E
        [1, 1],   // SE
        [0, 1],   // S
        [-1, 1],  // SW
        [-1, 0],  // W
        [-1, -1], // NW
        [0, -1],  // N
        [1, -1]   // NE
    ];

    let x = startX, y = startY;
    let dir = 6; // Start looking North
    let firstMove = true;
    const maxIter = 10000;
    let iter = 0;

    do {
        points.push({ x: x - width / 2, y: y - height / 2 }); // Center coordinates

        // Look for next boundary pixel
        let found = false;
        for (let i = 0; i < 8; i++) {
            const checkDir = (dir + i) % 8;
            const nx = x + dirs[checkDir][0];
            const ny = y + dirs[checkDir][1];

            if (isSolid(nx, ny)) {
                x = nx;
                y = ny;
                dir = (checkDir + 5) % 8; // Turn left and look back
                found = true;
                firstMove = false;
                break;
            }
        }

        if (!found) break;
        iter++;

        if (iter > maxIter) {
            console.warn(`Boundary tracing exceeded max iterations for ${emoji}`);
            break;
        }

    } while (firstMove || x !== startX || y !== startY);

    if (points.length < 3) {
        console.warn(`Too few boundary points for ${emoji}: ${points.length}`);
        return null;
    }

    // Simplify using Douglas-Peucker
    function simplifyDP(points, epsilon) {
        if (points.length < 3) return points;

        const getSqDist = (p, p1, p2) => {
            let x = p1.x, y = p1.y;
            let dx = p2.x - x, dy = p2.y - y;

            if (dx !== 0 || dy !== 0) {
                const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
                if (t > 1) {
                    x = p2.x; y = p2.y;
                } else if (t > 0) {
                    x += dx * t; y += dy * t;
                }
            }

            dx = p.x - x;
            dy = p.y - y;
            return dx * dx + dy * dy;
        };

        let maxDist = 0, index = 0;
        const end = points.length - 1;
        const sqEpsilon = epsilon * epsilon;

        for (let i = 1; i < end; i++) {
            const dist = getSqDist(points[i], points[0], points[end]);
            if (dist > maxDist) {
                maxDist = dist;
                index = i;
            }
        }

        if (maxDist > sqEpsilon) {
            const left = simplifyDP(points.slice(0, index + 1), epsilon);
            const right = simplifyDP(points.slice(index), epsilon);
            return left.slice(0, -1).concat(right);
        }

        return [points[0], points[end]];
    }

    // Simplify with tolerance
    const simplified = simplifyDP(points, 2.0);

    return simplified;
}

