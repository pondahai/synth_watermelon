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

const SHAPE_MODE = 'ELLIPSE'; // 'CIRCLE', 'ELLIPSE', 'POLYGON'
const SHOW_COLLISION_OUTLINES = false; // Set to true to show collision boundaries
const TEST_MODE = false; // If true, fruits spawn sequentially for debugging

const WALL_THICKNESS = 50;
const DANGER_LINE_Y = 100; // Distance from top where game over checks happen

const ALPHA_THRESHOLD = 150;

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

    // Create body based on SHAPE_MODE
    let body;

    if (SHAPE_MODE === 'POLYGON' && fruitConfig.vertices && fruitConfig.vertices.length > 0) {
        body = Bodies.fromVertices(
            gameArea.clientWidth / 2,
            50,
            fruitConfig.vertices,
            {
                isStatic: true,
                label: 'current',
                render: { visible: false }
            },
            false, 0.01, 0.0001
        );
        // Fallback or cleanup logic for polygon...
        if (!body) {
            body = Bodies.circle(gameArea.clientWidth / 2, 50, fruitConfig.radius, {
                isStatic: true,
                label: 'current',
                render: { visible: false }
            });
        } else {
            if (body.parts && body.parts.length > 1) {
                for (let i = 1; i < body.parts.length; i++) {
                    if (body.parts[i].render.sprite) body.parts[i].render.sprite = null;
                    body.parts[i].label = 'current';
                }
            }
        }
    } else if (SHAPE_MODE === 'ELLIPSE' && fruitConfig.metrics) {
        // Create circle then scale and rotate it
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

        // Apply PCA metrics
        Matter.Body.scale(body, fruitConfig.metrics.scaleX, fruitConfig.metrics.scaleY);
        Matter.Body.setAngle(body, fruitConfig.metrics.angle);

    } else {
        // Default CIRCLE
        if (SHAPE_MODE === 'POLYGON') console.log(`[CREATE] No vertices for ${fruitConfig.emoji}, using circle`);

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
        if (TEST_MODE) {
            // Sequential spawn for testing
            // We use currentFruitIndex (which was just dropped) to determine the next one
            // But actually we want to cycle through ALL fruits, not just small ones
            // Let's use a global counter or just increment from the last dropped one
            // The user wants to see "every emoji fruit appear in order"
            // The 'nextFruitIndex' variable tracks what's coming next.
            // So we just increment it.
            nextFruitIndex = (nextFruitIndex + 1) % FRUITS.length;
        } else {
            currentFruitIndex = nextFruitIndex;
            nextFruitIndex = Math.floor(Math.random() * 3); // Only small fruits spawn
        }

        // Update current to what was next
        currentFruitIndex = nextFruitIndex;

        // If in test mode, we might want to pre-set the *next* next one to be +1
        // But the logic above is a bit mixed. 
        // Standard logic: current becomes what next was. Next becomes random.
        // Test logic: current becomes what next was. Next becomes current + 1.

        if (TEST_MODE) {
            nextFruitIndex = (currentFruitIndex + 1) % FRUITS.length;
        }

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
                if (SHAPE_MODE === 'POLYGON' && newConfig.vertices && newConfig.vertices.length > 0) {
                    newBody = Bodies.fromVertices(
                        newX, newY, newConfig.vertices,
                        { label: newIndex.toString(), render: { visible: false } },
                        false, 0.01, 0.0001
                    );
                    if (!newBody) {
                        newBody = Bodies.circle(newX, newY, newConfig.radius, { label: newIndex.toString(), render: { visible: false } });
                    } else {
                        if (newBody.parts && newBody.parts.length > 1) {
                            for (let i = 1; i < newBody.parts.length; i++) {
                                if (newBody.parts[i].render.sprite) newBody.parts[i].render.sprite = null;
                                newBody.parts[i].label = newIndex.toString();
                            }
                        }
                    }
                } else if (SHAPE_MODE === 'ELLIPSE' && newConfig.metrics) {
                    newBody = Bodies.circle(newX, newY, newConfig.radius, { label: newIndex.toString(), render: { visible: false } });

                    Matter.Body.scale(newBody, newConfig.metrics.scaleX, newConfig.metrics.scaleY);
                    Matter.Body.setAngle(newBody, newConfig.metrics.angle);
                } else {
                    newBody = Bodies.circle(newX, newY, newConfig.radius, { label: newIndex.toString(), render: { visible: false } });
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
// Pre-calculate shapes based on mode
FRUITS.forEach(fruit => {
    if (SHAPE_MODE === 'POLYGON') {
        fruit.vertices = generateEmojiVertices(fruit.emoji, fruit.radius);
    } else if (SHAPE_MODE === 'ELLIPSE') {
        fruit.metrics = calculateEmojiMetrics(fruit.emoji, fruit.radius);
    }
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

        // Correct rotation: subtract the initial PCA angle so we don't double-rotate
        // The sprite has intrinsic rotation 'metrics.angle', physics body has 'body.angle'
        // We want to rotate the sprite by (body.angle - metrics.angle)
        let rotation = body.angle;
        let offsetX = 0;
        let offsetY = 0;

        if (SHAPE_MODE === 'ELLIPSE' && fruitConfig.metrics) {
            rotation -= fruitConfig.metrics.angle;
            // Apply centroid offset (rotated)
            // Actually, we just translate in the local unrotated frame
            offsetX = fruitConfig.metrics.offset.x;
            offsetY = fruitConfig.metrics.offset.y;
        }

        ctx.rotate(rotation);

        // Shift so that the visual center matches the physics center (centroid)
        // We want the centroid (which is at +offset from geometric center) to be at (0,0)
        // So we shift the drawing (geometric center) by -offset
        ctx.translate(-offsetX, -offsetY);

        ctx.font = `${fruitConfig.radius * 2}px Arial`;
        ctx.fillText(fruitConfig.emoji, 0, 0);
        ctx.restore();
    }

    // Uncomment below to show collision outlines for debugging
    if (SHOW_COLLISION_OUTLINES) {
        ctx.beginPath();
        for (let i = 0; i < bodies.length; i += 1) {
            const body = bodies[i];
            if (body.isStatic && body.label !== 'current') continue;

            // For circles, we need to draw a circle path manually if vertices aren't enough or if it's a true circle body
            // But Matter.js bodies always have vertices. Circles have many vertices.
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
    }
});

// Vertex Generation Logic

function generateEmojiVertices(emoji, radius) {
    const size = Math.ceil(radius * 2.5);
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
    const width = imageData.width;
    const height = imageData.height;

    // Helper to check if pixel is solid
    // Increased threshold to ignore shadows/glow which skew the PCA
    const threshold = ALPHA_THRESHOLD;
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

function calculateEmojiMetrics(emoji, radius) {
    const size = Math.ceil(radius * 2.5);
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
    const width = imageData.width;
    const height = imageData.height;

    // Image Moments Calculation (PCA)
    let m00 = 0, m10 = 0, m01 = 0, m11 = 0, m20 = 0, m02 = 0;
    let count = 0;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const alpha = data[(y * width + x) * 4 + 3];
            if (alpha > ALPHA_THRESHOLD) {
                const val = 1; // Treat as binary mask
                m00 += val;
                m10 += x * val;
                m01 += y * val;
                m11 += x * y * val;
                m20 += x * x * val;
                m02 += y * y * val;
                count++;
            }
        }
    }

    if (count < 10) return null;

    // Centroid
    const x_bar = m10 / m00;
    const y_bar = m01 / m00;

    // Central Moments
    const mu20 = m20 - x_bar * m10;
    const mu02 = m02 - y_bar * m01;
    const mu11 = m11 - x_bar * m01;

    // Covariance Matrix
    const covXX = mu20 / m00;
    const covYY = mu02 / m00;
    const covXY = mu11 / m00;

    // Eigenvalues
    const common = Math.sqrt(Math.pow(covXX - covYY, 2) + 4 * Math.pow(covXY, 2));
    const lambda1 = (covXX + covYY + common) / 2; // Major axis
    const lambda2 = (covXX + covYY - common) / 2; // Minor axis

    // Orientation angle
    const angle = 0.5 * Math.atan2(2 * covXY, covXX - covYY);

    // Semi-axes lengths (approximation for uniform ellipse)
    // For a uniform ellipse, lambda = a^2 / 4
    // So a = 2 * sqrt(lambda)
    const a = 2 * Math.sqrt(lambda1);
    const b = 2 * Math.sqrt(lambda2);

    // Scale factors relative to the base radius
    // We want the final semi-axes to be a and b
    // The base circle has radius 'radius'

    // So we scale by a/radius and b/radius

    // Safety clamp to prevent extremely thin shapes
    const scaleX = Math.max(0.2, a / radius);
    const scaleY = Math.max(0.2, b / radius);

    console.log(`[METRICS] ${emoji}: a = ${a.toFixed(2)}, b = ${b.toFixed(2)}, angle = ${(angle * 180 / Math.PI).toFixed(2)} deg, offset = (${x_bar - size / 2}, ${y_bar - size / 2})`);

    // --- DEBUG VISUALIZATION ---
    if (TEST_MODE) {
        let debugContainer = document.getElementById('debug-container');
        if (!debugContainer) {
            debugContainer = document.createElement('div');
            debugContainer.id = 'debug-container';
            debugContainer.style.position = 'fixed';
            debugContainer.style.bottom = '0';
            debugContainer.style.left = '0';
            debugContainer.style.width = '100%';
            debugContainer.style.height = '300px';
            debugContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
            debugContainer.style.borderTop = '2px solid #333';
            debugContainer.style.display = 'flex';
            debugContainer.style.alignItems = 'center';
            debugContainer.style.overflowX = 'auto';
            debugContainer.style.zIndex = '9999';
            debugContainer.style.padding = '10px';
            document.body.appendChild(debugContainer);
        }

        const debugCanvas = document.createElement('canvas');
        debugCanvas.width = size;
        debugCanvas.height = size;
        debugCanvas.style.width = `${size}px`;
        debugCanvas.style.height = `${size}px`;
        debugCanvas.style.border = '1px solid #ccc';
        debugCanvas.style.margin = '0 5px';
        debugCanvas.style.flexShrink = '0';

        const dCtx = debugCanvas.getContext('2d');
        dCtx.font = `${radius * 2.2}px Arial`;
        dCtx.textAlign = 'center';
        dCtx.textBaseline = 'middle';
        dCtx.fillText(emoji, size / 2, size / 2);

        // Draw pixels used
        dCtx.fillStyle = 'rgba(0, 255, 0, 0.5)';
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const alpha = data[(y * width + x) * 4 + 3];
                if (alpha > ALPHA_THRESHOLD) { // Match the calculation threshold
                    dCtx.fillRect(x, y, 1, 1);
                }
            }
        }

        // Draw Centroid
        dCtx.fillStyle = 'blue';
        dCtx.beginPath();
        dCtx.arc(x_bar, y_bar, 5, 0, Math.PI * 2); // Larger dot
        dCtx.fill();

        // Draw Axes
        dCtx.strokeStyle = 'red';
        dCtx.lineWidth = 4; // Thicker lines

        // Major Axis
        dCtx.beginPath();
        dCtx.moveTo(x_bar - Math.cos(angle) * a, y_bar - Math.sin(angle) * a);
        dCtx.lineTo(x_bar + Math.cos(angle) * a, y_bar + Math.sin(angle) * a);
        dCtx.stroke();

        // Minor Axis
        dCtx.beginPath();
        dCtx.moveTo(x_bar - Math.cos(angle + Math.PI / 2) * b, y_bar - Math.sin(angle + Math.PI / 2) * b);
        dCtx.lineTo(x_bar + Math.cos(angle + Math.PI / 2) * b, y_bar + Math.sin(angle + Math.PI / 2) * b);
        dCtx.stroke();

        // Label
        dCtx.fillStyle = 'black';
        dCtx.font = '20px Arial';
        dCtx.fillText(emoji, 20, 20);

        debugContainer.appendChild(debugCanvas);
    }
    // ---------------------------

    return {
        scaleX: scaleX,
        scaleY: scaleY,
        angle: angle,
        offset: { x: x_bar - size / 2, y: y_bar - size / 2 }
    };
}

