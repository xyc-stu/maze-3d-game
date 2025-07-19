// 初始化Three.js场景
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gameCanvas') });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

// 迷宫参数
const mazeSize = 15; // 迷宫尺寸
const cellSize = 4;  // 单元格大小
const wallHeight = 3; // 墙高

// 迷宫数据结构 (0=通道, 1=墙)
let maze = [];

// 生成迷宫 (深度优先算法)
function generateMaze() {
    // 初始化迷宫全为墙
    maze = Array(mazeSize).fill().map(() => Array(mazeSize).fill(1));
    
    // 深度优先算法实现
    const stack = [];
    const startX = 1, startY = 1;
    maze[startY][startX] = 0;
    stack.push([startX, startY]);
    
    const directions = [[0, -2], [2, 0], [0, 2], [-2, 0]];
    
    while (stack.length > 0) {
        const [x, y] = stack.pop();
        const shuffledDirs = directions.sort(() => Math.random() - 0.5);
        
        for (const [dx, dy] of shuffledDirs) {
            const nx = x + dx, ny = y + dy;
            if (nx > 0 && nx < mazeSize-1 && ny > 0 && ny < mazeSize-1 && maze[ny][nx] === 1) {
                maze[ny][nx] = 0;
                maze[y + dy/2][x + dx/2] = 0; // 打通中间墙
                stack.push([nx, ny]);
            }
        }
    }
    
    // 设置出口
    maze[mazeSize-2][mazeSize-2] = 2;
}

// 创建迷宫墙壁
function createMazeWalls() {
    const wallMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x3498db,
        roughness: 0.8,
        metalness: 0.2
    });
    
    for (let y = 0; y < mazeSize; y++) {
        for (let x = 0; x < mazeSize; x++) {
            if (maze[y][x] === 1) {
                const wall = new THREE.Mesh(
                    new THREE.BoxGeometry(cellSize, wallHeight, cellSize),
                    wallMaterial
                );
                wall.position.set(
                    (x - mazeSize/2) * cellSize,
                    wallHeight/2,
                    (y - mazeSize/2) * cellSize
                );
                wall.castShadow = true;
                wall.receiveShadow = true;
                scene.add(wall);
            }
        }
    }
}

// 创建地面
function createGround() {
    const groundGeometry = new THREE.PlaneGeometry(
        mazeSize * cellSize,
        mazeSize * cellSize
    );
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x2ecc71,
        roughness: 0.9,
        metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    scene.add(ground);
}

// 灯光设置
function setupLights() {
    // 环境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    
    // 主方向光
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    scene.add(directionalLight);
    
    // 补光
    const fillLight = new THREE.DirectionalLight(0xccddff, 0.3);
    fillLight.position.set(-10, 10, -10);
    scene.add(fillLight);
    
    // 半球光 - 增强环境效果
    const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.2);
    scene.add(hemisphereLight);
}

// 玩家变量
let player;
const playerSpeed = 0.2;
let gameActive = true;
let startTime = Date.now();
let timerInterval;

// 创建玩家
function createPlayer() {
    const playerGeometry = new THREE.SphereGeometry(1, 8, 8);
    const playerMaterial = new THREE.MeshStandardMaterial({
        color: 0xff5722,
        roughness: 0.7,
        metalness: 0.3
    });
    player = new THREE.Mesh(playerGeometry, playerMaterial);
    player.position.set(-mazeSize/2 * cellSize + cellSize, 1, -mazeSize/2 * cellSize + cellSize);
    player.castShadow = true;
    scene.add(player);
}

// 键盘控制
function setupControls() {
    const keyState = {};
    window.addEventListener('keydown', (e) => {
        keyState[e.key.toLowerCase()] = true;
    });
    window.addEventListener('keyup', (e) => {
        keyState[e.key.toLowerCase()] = false;
    });
    
    return keyState;
}

// 检测碰撞
function checkCollision(newX, newZ) {
    // 转换为网格坐标
    const gridX = Math.floor((newX + mazeSize/2 * cellSize) / cellSize);
    const gridZ = Math.floor((newZ + mazeSize/2 * cellSize) / cellSize);
    
    // 检查是否超出边界
    if (gridX < 0 || gridX >= mazeSize || gridZ < 0 || gridZ >= mazeSize) {
        return true;
    }
    
    // 检查是否为墙
    return maze[gridZ][gridX] === 1;
}

// 更新玩家位置
function updatePlayerPosition(keyState) {
    if (!gameActive) return;
    
    let moveX = 0;
    let moveZ = 0;
    
    if (keyState['w']) moveZ -= playerSpeed;
    if (keyState['s']) moveZ += playerSpeed;
    if (keyState['a']) moveX -= playerSpeed;
    if (keyState['d']) moveX += playerSpeed;
    
    // 尝试X轴移动
    if (!checkCollision(player.position.x + moveX, player.position.z)) {
        player.position.x += moveX;
    }
    
    // 尝试Z轴移动
    if (!checkCollision(player.position.x, player.position.z + moveZ)) {
        player.position.z += moveZ;
    }
    
    // 检查胜利条件
    const exitX = (mazeSize - 2) * cellSize - mazeSize/2 * cellSize;
    const exitZ = (mazeSize - 2) * cellSize - mazeSize/2 * cellSize;
    const distance = Math.sqrt(
        Math.pow(player.position.x - exitX, 2) +
        Math.pow(player.position.z - exitZ, 2)
    );
    
    if (distance < 2) {
        gameActive = false;
        clearInterval(timerInterval);
        document.getElementById('instructions').textContent = '恭喜！你成功逃出迷宫！';
    }
}

// 更新计时器
function updateTimer() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const seconds = (elapsed % 60).toString().padStart(2, '0');
    document.getElementById('timer').textContent = `时间: ${minutes}:${seconds}`;
}

// 初始化游戏
function initGame() {
    generateMaze();
    createMazeWalls();
    createGround();
    setupLights();
    createPlayer();
    
    // 相机初始位置
    camera.position.set(0, 10, mazeSize/2 * cellSize);
    camera.lookAt(0, 0, 0);
    
    // 启动计时器
    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 1000);
    
    // 设置控制
    const keyState = setupControls();
    
    // 动画循环
    function animate() {
        requestAnimationFrame(animate);
        updatePlayerPosition(keyState);
        renderer.render(scene, camera);
    }
    animate();
}

// 窗口大小调整
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// 启动游戏
initGame();