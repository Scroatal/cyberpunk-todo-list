// Ensure Three.js is loaded
if (typeof THREE === 'undefined') {
    console.error("THREE.js library not loaded!");
} else {
    console.log(`Three.js version: ${THREE.REVISION}`);

    // --- Scene Variables ---
    let scene, camera, renderer;
    let stars, gridHelper, sun, mountains;
    const clock = new THREE.Clock();
    const canvasContainer = document.getElementById('three-canvas-container');

    // --- Cyberpunk Colors ---
    const colors = {
        bg: 0x0f0f1e, // Matches CSS --bg-color
        primary: 0xff53a2, // Hot Pink
        secondary: 0x5a00df, // Purple
        tertiary: 0x00ffd5, // Cyan
        sun: 0xff53a2, // Sun color (pink)
        grid: 0x5a00df, // Grid color (purple)
        mountains: 0x00ffd5, // Mountain color (cyan)
        stars: 0xffffff
    };

    // --- Initialization ---
    function initThree() {
        // 1. Scene
        scene = new THREE.Scene();
        // scene.fog = new THREE.Fog(colors.bg, 10, 50); // Optional fog

        // 2. Camera
        const fov = 60; // Adjust FOV for perspective
        const aspect = window.innerWidth / window.innerHeight;
        const near = 0.1;
        const far = 2000; // Increase far plane for larger scene
        camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        camera.position.set(0, 5, 20); // Position camera higher and further back
        camera.lookAt(0, 0, 0); // Look towards the center

        // 3. Renderer
        renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true // Keep alpha if needed, but bg color is set
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        // renderer.setClearColor(colors.bg); // Set background color directly

        // 4. Append canvas
        if (canvasContainer) {
            canvasContainer.appendChild(renderer.domElement);
        } else {
            console.error("Three.js canvas container not found!");
            return;
        }

        // 5. Create Scene Elements
        createStarfield();
        createGridFloor();
        createSun();
        createMountains();

        // 6. Handle window resize
        window.addEventListener('resize', onWindowResize, false);

        // 7. Start animation loop
        animate();

        console.log("Cyberpunk Three.js scene initialized.");
    }

    // --- Scene Element Creation ---

    function createStarfield() {
        const starCount = 10000;
        const positions = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount; i++) {
            const i3 = i * 3;
            positions[i3] = (Math.random() - 0.5) * 2000; // Spread stars far out
            positions[i3 + 1] = (Math.random() - 0.5) * 2000;
            positions[i3 + 2] = (Math.random() - 0.5) * 2000;
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({
            color: colors.stars,
            size: 1.5,
            sizeAttenuation: true
        });
        stars = new THREE.Points(geometry, material);
        scene.add(stars);
    }

    function createGridFloor() {
        const size = 200;
        const divisions = 40;
        gridHelper = new THREE.GridHelper(size, divisions, colors.grid, colors.grid);
        gridHelper.material.opacity = 0.3; // Make grid subtle
        gridHelper.material.transparent = true;
        gridHelper.position.y = -10; // Position grid below origin
        // gridHelper.rotation.x = Math.PI / 2; // Rotate to be a floor (optional, depends on look)
        scene.add(gridHelper);
    }

    function createSun() {
        const geometry = new THREE.SphereGeometry(5, 32, 32);
        const material = new THREE.MeshBasicMaterial({
            color: colors.sun,
            // Use emissive for glow effect if not using post-processing
            // emissive: colors.sun,
            // emissiveIntensity: 1.5
        });
        sun = new THREE.Mesh(geometry, material);
        sun.position.set(0, 10, -50); // Position sun in the distance
        scene.add(sun);

        // Add a point light emanating from the sun for basic lighting
        const sunLight = new THREE.PointLight(colors.sun, 1, 500);
        sunLight.position.copy(sun.position);
        scene.add(sunLight);
    }

    function createMountains() {
        // Simple placeholder plane geometry
        const geometry = new THREE.PlaneGeometry(300, 100, 50, 20); // Width, Height, Segments

        // Add some basic height variation (displacement)
        const positionAttribute = geometry.getAttribute('position');
        for (let i = 0; i < positionAttribute.count; i++) {
            const x = positionAttribute.getX(i);
            const y = positionAttribute.getY(i);
            // Simple noise-like function for height
            const z = Math.sin(x * 0.1) * Math.cos(y * 0.1) * 10 + Math.random() * 5;
            positionAttribute.setZ(i, z);
        }
        geometry.computeVertexNormals(); // Needed if using lighting later

        const material = new THREE.MeshBasicMaterial({
            color: colors.mountains,
            wireframe: true,
            transparent: true,
            opacity: 0.5
        });
        mountains = new THREE.Mesh(geometry, material);
        mountains.position.set(0, -5, -100); // Position behind grid/sun
        mountains.rotation.x = -Math.PI / 2.5; // Tilt backwards slightly
        scene.add(mountains);
    }


    // --- Event Handlers ---

    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
    }

    // --- Animation Loop ---

    function animate() {
        requestAnimationFrame(animate);
        const elapsedTime = clock.getElapsedTime();

        // 1. Starfield movement (subtle rotation)
        if (stars) {
            stars.rotation.y = elapsedTime * 0.01;
            stars.rotation.x = elapsedTime * 0.005;
        }

        // 2. Sun pulse effect (scale)
        if (sun) {
            const scalePulse = 1.0 + Math.sin(elapsedTime * 1.5) * 0.05; // Gentle pulse
            sun.scale.set(scalePulse, scalePulse, scalePulse);
            // Could also animate material.emissiveIntensity if using emissive
        }

        // 3. Grid movement (optional - subtle scroll)
        // if (gridHelper) {
        //     gridHelper.position.z = (elapsedTime * 2) % 10 - 5; // Creates a scrolling effect
        // }


        renderer.render(scene, camera);
    }

    // --- Initialize ---
    if (canvasContainer) {
        initThree();
    } else {
        console.error("Could not find canvas container for Three.js");
    }
}