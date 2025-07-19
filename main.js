// 初始化Three.js场景
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// 获取canvas元素
const canvas = document.getElementById('gameCanvas');
if (!canvas) {
    console.error('Canvas element not found!');
}

// 初始化渲染器
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.setClearColor(0x87CEEB); // 设置天空背景色

// 添加轨道控制器
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// 迷宫参数
const mazeSize = 15; // 迷宫尺寸
const cellSize = 4;  // 单元格大小

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
    
    // 确保出口不被封死
    maze[mazeSize-3][mazeSize-2] = 0;
    maze[mazeSize-2][mazeSize-3] = 0;
    maze[mazeSize-2][mazeSize-2] = 0; // 出口位置
    
    // 设置出口标志
    maze[mazeSize-2][mazeSize-2] = 2;
}

// 创建迷宫墙壁
function createMazeWalls() {
    const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0x3498db,
        roughness: 0.8,
        metalness: 0.2
    });
    
    // 出口标记材质（改为红色）
    const exitMaterial = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        roughness: 0.6,
        metalness: 0.3,
        emissive: 0xff3333
    });
    
    for (let y = 0; y < mazeSize; y++) {
        for (let x = 0; x < mazeSize; x++) {
            if (maze[y][x] === 1) {
                const wall = new THREE.Mesh(
                    new THREE.BoxGeometry(cellSize, 3, cellSize),
                    wallMaterial
                );
                wall.position.set(
                    (x - mazeSize/2) * cellSize,
                    1.5,
                    (y - mazeSize/2) * cellSize
                );
                wall.castShadow = true;
                wall.receiveShadow = true;
                scene.add(wall);
            } else if (maze[y][x] === 2) { // 出口位置
                const exitMarker = new THREE.Mesh(
                    new THREE.BoxGeometry(cellSize, 0.2, cellSize),
                    exitMaterial
                );
                exitMarker.position.set(
                    (x - mazeSize/2) * cellSize,
                    0.1,
                    (y - mazeSize/2) * cellSize
                );
                scene.add(exitMarker);
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
    
    // 主方向光（将绑定到相机）
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
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
    
    return directionalLight;
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

// 基于相机方向的移动向量
function getMovementVector(keyState) {
    const direction = new THREE.Vector3();
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    
    // 获取相机方向
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    
    // 计算右方向
    right.crossVectors(new THREE.Vector3(0, 1, 0), forward);
    
    // 根据按键组合移动方向
    if (keyState['w']) direction.add(forward);
    if (keyState['s']) direction.sub(forward);
    if (keyState['a']) direction.add(right);
    if (keyState['d']) direction.sub(right);
    
    // 归一化并应用速度
    if (direction.length() > 0) {
        direction.normalize().multiplyScalar(playerSpeed);
    }
    
    return direction;
}

// 碰撞检测（分轴检测，允许滑动）
function checkCollision(newPos) {
    // 分别检测X轴和Z轴移动
    const moveX = new THREE.Vector3(newPos.x, player.position.y, player.position.z);
    const moveZ = new THREE.Vector3(player.position.x, player.position.y, newPos.z);
    
    // 创建射线
    const raycaster = new THREE.Raycaster();
    const walls = scene.children.filter(obj => 
        obj.geometry && 
        obj.geometry.type === 'BoxGeometry' && 
        obj.position.y > 0.5 // 只检测墙壁
    );
    
    // 检测X轴移动
    let canMoveX = true;
    raycaster.set(player.position, moveX.clone().sub(player.position).normalize());
    raycaster.far = player.position.distanceTo(moveX) + 1;
    if (raycaster.intersectObjects(walls).length > 0) {
        canMoveX = false;
    }
    
    // 检测Z轴移动
    let canMoveZ = true;
    raycaster.set(player.position, moveZ.clone().sub(player.position).normalize());
    raycaster.far = player.position.distanceTo(moveZ) + 1;
    if (raycaster.intersectObjects(walls).length > 0) {
        canMoveZ = false;
    }
    
    return {
        canMoveX,
        canMoveZ
    };
}

// 更新玩家位置
function updatePlayerPosition(keyState, mainLight) {
    if (!gameActive) return;
    
    // 更新光源位置跟随相机
    mainLight.position.copy(camera.position);
    
    // 获取基于相机方向的移动向量
    const moveVector = getMovementVector(keyState);
    
    // 计算新位置
    const newPos = player.position.clone().add(moveVector);
    
    // 分轴检测碰撞
    const collision = checkCollision(newPos);
    
    // 允许滑动：如果一个方向受阻，允许另一个方向移动
    if (collision.canMoveX) {
        player.position.x = newPos.x;
    }
    if (collision.canMoveZ) {
        player.position.z = newPos.z;
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
        
        // 计算通关时间
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        const record = `${minutes}:${seconds}`;
        
        // 保存记录到localStorage
        let records = JSON.parse(localStorage.getItem('mazeRecords') || '[]');
        records.push({
            time: record,
            date: new Date().toLocaleString()
        });
        localStorage.setItem('mazeRecords', JSON.stringify(records));
        
        // 显示通关记录（使用新样式）
        let recordsHtml = `<div>恭喜！你成功逃出迷宫！用时：<strong>${record}</strong></div>`;
        
        if (records.length > 0) {
            recordsHtml += `
                <div class="records-container">
                    <h3>历史记录</h3>
                    <table id="records-table">
                        <thead>
                            <tr>
                                <th>通关时间</th>
                                <th>日期</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${records.slice(-5).map(record => `
                                <tr>
                                    <td>${record.time}</td>
                                    <td>${record.date}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <button id="restart-button" onclick="location.reload()">重新开始</button>
                </div>
            `;
        } else {
            recordsHtml += `<button id="restart-button" onclick="location.reload()">重新开始</button>`;
        }
        
        document.getElementById('instructions').innerHTML = recordsHtml;
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
    const mainLight = setupLights(); // 获取主光源
    createPlayer();
    
    // 相机初始位置（提高高度）
    camera.position.set(0, 50, 50);
    controls.target.set(0, 0, 0);
    controls.update();
    
    // 调整主光源位置（高于迷宫）
    mainLight.position.set(0, 50, 0);
    
    // 启动计时器
    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 1000);
    
    // 设置控制
    const keyState = setupControls();
    
    // 动画循环
    function animate() {
        requestAnimationFrame(animate);
        updatePlayerPosition(keyState, mainLight);
        controls.update(); // 更新控制器
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