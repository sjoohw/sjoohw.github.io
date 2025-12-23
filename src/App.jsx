import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
// Fix import error by specifying .js extension
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const COLOR_PALETTE = [
    { name: 'Dark', hex: '#111827' },
    { name: 'Gray', hex: '#6b7280' },
    { name: 'White', hex: '#ffffff' },
    { name: 'Red', hex: '#ef4444' },
    { name: 'Orange', hex: '#f97316' },
    { name: 'Yellow', hex: '#eab308' },
    { name: 'Green', hex: '#22c55e' },
    { name: 'Blue', hex: '#3b82f6' },
];

export default function App() {
    const mountRef = useRef(null);
    const svgRef = useRef(null);
    
    // State management
    const [h, setH] = useState(1);
    const [k, setK] = useState(1);
    const [l, setL] = useState(1);
    const [offset, setOffset] = useState(0);
    const [opacity, setOpacity] = useState(0.5);
    const [showBonds, setShowBonds] = useState(true);
    const [showGrid, setShowGrid] = useState(true);
    const [showAxis, setShowAxis] = useState(true);
    const [show2D, setShow2D] = useState(true);
    const [showBelowOnly, setShowBelowOnly] = useState(false);
    const [structureSize, setStructureSize] = useState(4); // 4x4x4
    const [atomSize, setAtomSize] = useState(5); // Atom radius
    const [showPanel, setShowPanel] = useState(true); // Panel toggle
    
    // Toast message state for Android UX
    const [toastMessage, setToastMessage] = useState(null);

    // Color settings state
    const [bgColor, setBgColor] = useState(COLOR_PALETTE[0].hex); // Default: Dark
    const [atomColor, setAtomColor] = useState(COLOR_PALETTE[2].hex); // Default: White
    const [bondColor, setBondColor] = useState(COLOR_PALETTE[1].hex); // Default: Gray
    const [planeColor, setPlaneColor] = useState(COLOR_PALETTE[7].hex); // Default: Blue
    
    // Color picker UI state
    const [activeColorPicker, setActiveColorPicker] = useState(null);

    // 2D Window drag state
    const [windowPos, setWindowPos] = useState({ x: 20, y: 20 });
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    // Three.js object refs
    const sceneRef = useRef(null);
    const planeMeshRef = useRef(null);
    const rendererRef = useRef(null);
    const cameraRef = useRef(null);
    const controlsRef = useRef(null);
    const gridHelperRef = useRef(null); 
    const axesHelperRef = useRef(null); 
    const frameIdRef = useRef(null); 

    // --- Toast Message Logic ---
    useEffect(() => {
        if (toastMessage) {
            const timer = setTimeout(() => setToastMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toastMessage]);

    // --- Image Saving Logic ---
    const handleSave3D = () => {
        if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
        const renderer = rendererRef.current;
        renderer.render(sceneRef.current, cameraRef.current);
        const link = document.createElement('a');
        link.download = `diamond_structure_3d_${h}${k}${l}.png`;
        link.href = renderer.domElement.toDataURL('image/png');
        link.click();
        setToastMessage("3D Image saved! 📸");
    };

    const handleSave2D = () => {
        if (!svgRef.current) return;
        const svgData = new XMLSerializer().serializeToString(svgRef.current);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        const width = 800;
        const height = 800;
        canvas.width = width;
        canvas.height = height;
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        img.onload = () => {
            // Use current background color for saving
            ctx.fillStyle = bgColor; 
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            const link = document.createElement('a');
            link.download = `diamond_section_2d_${h}${k}${l}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            URL.revokeObjectURL(url);
            setToastMessage("2D Section saved! 📸");
        };
        img.src = url;
    };

    // --- Dragging Logic (Mouse & Touch) ---
    const startDrag = (clientX, clientY) => {
        setIsDragging(true);
        dragOffset.current = {
            x: clientX - windowPos.x,
            y: clientY - windowPos.y
        };
    };

    const handleMouseDown = (e) => {
        if (e.target.closest('button')) return;
        startDrag(e.clientX, e.clientY);
    };

    const handleTouchStart = (e) => {
        if (e.target.closest('button')) return;
        const touch = e.touches[0];
        startDrag(touch.clientX, touch.clientY);
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isDragging) return;
            setWindowPos({
                x: e.clientX - dragOffset.current.x,
                y: e.clientY - dragOffset.current.y
            });
        };

        const handleTouchMove = (e) => {
            if (!isDragging) return;
            const touch = e.touches[0];
            setWindowPos({
                x: touch.clientX - dragOffset.current.x,
                y: touch.clientY - dragOffset.current.y
            });
        };

        const handleEndDrag = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleEndDrag);
            window.addEventListener('touchmove', handleTouchMove);
            window.addEventListener('touchend', handleEndDrag);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleEndDrag);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleEndDrag);
        };
    }, [isDragging]);

    // --- Data Generation (Memoized) ---
    const diamondData = useMemo(() => {
        const atoms = [];
        const latticeConstant = 40; 
        const basis = [
            [0, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5],
            [0.25, 0.25, 0.25], [0.75, 0.75, 0.25], [0.75, 0.25, 0.75], [0.25, 0.75, 0.75]
        ];
        for (let x = 0; x < structureSize; x++) {
            for (let y = 0; y < structureSize; y++) {
                for (let z = 0; z < structureSize; z++) {
                    basis.forEach(b => {
                        atoms.push({
                            x: (x + b[0]) * latticeConstant,
                            y: (y + b[1]) * latticeConstant,
                            z: (z + b[2]) * latticeConstant
                        });
                    });
                }
            }
        }
        const centerVal = (structureSize * latticeConstant) / 2;
        const center = new THREE.Vector3(centerVal, centerVal, centerVal);
        return { atoms, center, latticeConstant };
    }, [structureSize]);

    // --- Coordinate System Calculation (Memoized) ---
    const planeBasis = useMemo(() => {
        if (h === 0 && k === 0 && l === 0) return null;
        const normalRaw = new THREE.Vector3(h, k, l);
        const normal = normalRaw.clone().normalize(); 
        let up = new THREE.Vector3(0, 1, 0);
        if (Math.abs(normal.dot(up)) > 0.99) up.set(1, 0, 0);
        const uRaw = new THREE.Vector3().crossVectors(up, normalRaw);
        const vRaw = new THREE.Vector3().crossVectors(normalRaw, uRaw);
        const diagRaw = new THREE.Vector3().addVectors(uRaw, vRaw);
        const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
        const gcd3 = (x, y, z) => gcd(Math.abs(x), gcd(Math.abs(y), Math.abs(z)));
        const formatVec = (v) => {
            const div = gcd3(Math.round(v.x), Math.round(v.y), Math.round(v.z)) || 1;
            return `[${Math.round(v.x/div)} ${Math.round(v.y/div)} ${Math.round(v.z/div)}]`;
        };
        return {
            uDir: uRaw.clone().normalize(),
            vDir: vRaw.clone().normalize(),
            uLabel: formatVec(uRaw),
            vLabel: formatVec(vRaw),
            diagLabel: formatVec(diagRaw)
        };
    }, [h, k, l]);

    // --- 2D Projection Logic (Updated for Dynamic Cross-Section) ---
    const atoms2D = useMemo(() => {
        if (!planeBasis) return [];
        const { uDir, vDir } = planeBasis;
        const normal = new THREE.Vector3(h, k, l).normalize();
        const planeOrigin = diamondData.center.clone().add(normal.clone().multiplyScalar(offset * 10));
        const projected = [];
        
        // 1. Threshold matches atom radius exactly
        const threshold = atomSize; 

        diamondData.atoms.forEach(atom => {
            const pos = new THREE.Vector3(atom.x, atom.y, atom.z);
            const vecToAtom = new THREE.Vector3().subVectors(pos, planeOrigin);
            
            // Perpendicular distance d to the plane
            const dist = vecToAtom.dot(normal);

            // 2. Check intersection (|d| < R)
            if (Math.abs(dist) < threshold) {
                const u = vecToAtom.dot(uDir);
                const v = vecToAtom.dot(vDir);
                
                // 3. Calculate cross-section radius: r_2d = sqrt(R^2 - d^2)
                const sectionRadius = Math.sqrt(Math.pow(atomSize, 2) - Math.pow(dist, 2));
                
                // 4. Calculate opacity: linear interpolation from center (0.9) to edge (0.5)
                // Ratio: 1 at center, 0 at edge
                const ratio = sectionRadius / atomSize;
                const opacity = 0.5 + (0.4 * ratio); 

                projected.push({ 
                    u, 
                    v, 
                    r: sectionRadius, // Calculated radius
                    opacity: opacity, // Calculated opacity
                    id: `${atom.x}-${atom.y}-${atom.z}` 
                });
            }
        });
        return projected;
    }, [h, k, l, offset, diamondData, planeBasis, atomSize]); 

    // --- 3D Scene Initialization & Update ---
    useEffect(() => {
        if (!mountRef.current) return;
        const width = mountRef.current.clientWidth;
        const height = mountRef.current.clientHeight;
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(bgColor); // Initial background color
        sceneRef.current = scene;
        const camera = new THREE.PerspectiveCamera(45, width / height, 1, 5000);
        camera.position.set(300, 300, 400);
        cameraRef.current = camera;
        
        // Android optimization: Limit pixelRatio to 2 to prevent performance issues on high-res devices
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
        mountRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;
        
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        // Explicit touch gesture settings
        controls.touches = {
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_PAN
        };
        controlsRef.current = controls;
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(100, 200, 100);
        scene.add(dirLight);
        const dirLight2 = new THREE.DirectionalLight(0xffccaa, 0.5);
        dirLight2.position.set(-100, -200, -100);
        scene.add(dirLight2);
        
        // Helpers
        const maxGridSize = 300; 
        const gridHelper = new THREE.GridHelper(maxGridSize, 10, 0x444444, 0x222222);
        gridHelper.position.set(maxGridSize/2, 0, maxGridSize/2);
        scene.add(gridHelper);
        gridHelperRef.current = gridHelper; 

        const axesHelper = new THREE.AxesHelper(60);
        scene.add(axesHelper);
        axesHelperRef.current = axesHelper; 

        const planeGeom = new THREE.PlaneGeometry(800, 800);
        const planeMat = new THREE.MeshPhongMaterial({ 
            color: planeColor, 
            side: THREE.DoubleSide, 
            transparent: true, 
            opacity: 0.5, 
            depthWrite: false, 
            shininess: 90
        });
        const planeMesh = new THREE.Mesh(planeGeom, planeMat);
        scene.add(planeMesh);
        planeMeshRef.current = planeMesh;
        const animate = () => {
            frameIdRef.current = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();
        const handleResize = () => {
            if (!mountRef.current) return;
            const w = mountRef.current.clientWidth;
            const h = mountRef.current.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(frameIdRef.current);
            if (mountRef.current && renderer.domElement) {
                mountRef.current.removeChild(renderer.domElement);
            }
            renderer.dispose();
        };
    }, []);

    // 3D Scene Background Update
    useEffect(() => {
        if (sceneRef.current) {
            sceneRef.current.background = new THREE.Color(bgColor);
        }
    }, [bgColor]);

    // 3D Grid/Axis Visibility Update
    useEffect(() => {
        if (gridHelperRef.current) {
            gridHelperRef.current.visible = showGrid;
        }
        if (axesHelperRef.current) {
            axesHelperRef.current.visible = showAxis;
        }
    }, [showGrid, showAxis]);

    // Update Structure (Atoms & Bonds) with Filter Logic
    useEffect(() => {
        const scene = sceneRef.current;
        if (!scene) return;
        const objectsToRemove = scene.children.filter(c => c.name === 'atoms' || c.name === 'bonds');
        objectsToRemove.forEach(obj => scene.remove(obj));
        const { atoms } = diamondData;

        // --- Filtering Logic for Show Below Only (Modified) ---
        const normal = new THREE.Vector3(h, k, l).normalize();
        const planeOrigin = diamondData.center.clone().add(normal.clone().multiplyScalar(offset * 10));
        
        let visibleAtoms = atoms;

        // Helper to check if a point is visible
        const isVisible = (point) => {
            if (!showBelowOnly) return true;
            if (h === 0 && k === 0 && l === 0) return true; 
            
            const vec = new THREE.Vector3().subVectors(point, planeOrigin);
            // Normal direction is +, opposite is -
            // Below Only: Always show if below.
            // Even if above (positive), show if distance is within radius (intersecting).
            // i.e., dot <= atomSize
            return vec.dot(normal) <= atomSize;
        };

        if (showBelowOnly && (h !== 0 || k !== 0 || l !== 0)) {
            visibleAtoms = atoms.filter(atom => {
                return isVisible(new THREE.Vector3(atom.x, atom.y, atom.z));
            });
        }
        
        // Atom Rendering (No clipping, full sphere)
        if (visibleAtoms.length > 0) {
            const atomGeo = new THREE.SphereGeometry(atomSize, 16, 16); 
            const atomMat = new THREE.MeshPhongMaterial({ 
                color: atomColor, 
                shininess: 50
                // side: default (FrontSide)
            });
            const atomMesh = new THREE.InstancedMesh(atomGeo, atomMat, visibleAtoms.length);
            atomMesh.name = 'atoms';
            const dummy = new THREE.Object3D();
            visibleAtoms.forEach((atom, i) => {
                dummy.position.set(atom.x, atom.y, atom.z);
                dummy.updateMatrix();
                atomMesh.setMatrixAt(i, dummy.matrix);
            });
            atomMesh.instanceMatrix.needsUpdate = true;
            scene.add(atomMesh);
        }
        
        // Bond Rendering (No clipping)
        if (showBonds) {
            const bonds = [];
            // Find bonds for all atoms
            for (let i = 0; i < atoms.length; i++) {
                for (let j = i + 1; j < atoms.length; j++) {
                    const p1 = new THREE.Vector3(atoms[i].x, atoms[i].y, atoms[i].z);
                    const p2 = new THREE.Vector3(atoms[j].x, atoms[j].y, atoms[j].z);
                    
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const dz = p1.z - p2.z;
                    const distSq = dx*dx + dy*dy + dz*dz;
                    
                    if (distSq > 290 && distSq < 310) {
                        // Show bond only if both atoms are visible
                        if (isVisible(p1) && isVisible(p2)) {
                            bonds.push({ start: p1, end: p2 });
                        }
                    }
                }
            }

            if (bonds.length > 0) {
                const bondGeo = new THREE.CylinderGeometry(1.5, 1.5, 1, 8);
                // Apply Bond Color
                const bondMat = new THREE.MeshPhongMaterial({ 
                    color: bondColor
                });
                const bondMesh = new THREE.InstancedMesh(bondGeo, bondMat, bonds.length);
                bondMesh.name = 'bonds';
                const bondDummy = new THREE.Object3D();
                const axis = new THREE.Vector3();
                const up = new THREE.Vector3(0, 1, 0);
                bonds.forEach((bond, idx) => {
                    const start = bond.start;
                    const end = bond.end;
                    const dist = start.distanceTo(end);
                    const mid = start.clone().add(end).multiplyScalar(0.5);
                    bondDummy.position.copy(mid);
                    bondDummy.scale.set(1, dist, 1);
                    axis.subVectors(end, start).normalize();
                    bondDummy.quaternion.setFromUnitVectors(up, axis);
                    bondDummy.updateMatrix();
                    bondMesh.setMatrixAt(idx, bondDummy.matrix);
                });
                bondMesh.instanceMatrix.needsUpdate = true;
                scene.add(bondMesh);
            }
        }
    }, [diamondData, showBonds, atomColor, bondColor, atomSize, showBelowOnly, h, k, l, offset]); 

    // Update Plane
    useEffect(() => {
        if (!planeMeshRef.current) return;
        const plane = planeMeshRef.current;
        if (h === 0 && k === 0 && l === 0) {
            plane.visible = false;
            return;
        }
        plane.visible = true;
        const normal = new THREE.Vector3(h, k, l).normalize();
        const initialNormal = new THREE.Vector3(0, 0, 1);
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(initialNormal, normal);
        plane.quaternion.copy(quaternion);
        const pos = diamondData.center.clone().add(normal.multiplyScalar(offset * 10));
        plane.position.copy(pos);
        plane.material.opacity = opacity;
        plane.material.color.set(planeColor); // Update Plane Color
    }, [h, k, l, offset, opacity, planeColor, diamondData.center]);

    return (
        <div className="relative w-full h-screen flex flex-col md:flex-row bg-gray-900 text-white overflow-hidden">
            <style>{`
                input[type=range] { accent-color: #3b82f6; }
                .control-panel {
                    background: rgba(30, 30, 30, 0.9);
                    backdrop-filter: blur(8px);
                    transition: transform 0.3s ease-in-out;
                }
                .control-panel::-webkit-scrollbar { width: 8px; }
                .control-panel::-webkit-scrollbar-track { background: #222; }
                .control-panel::-webkit-scrollbar-thumb { background: #444; border-radius: 4px; }
                .control-panel::-webkit-scrollbar-thumb:hover { background: #555; }
                .subset-window {
                    border: 1px solid #4b5563;
                    backdrop-filter: blur(4px);
                    position: absolute;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
                }
                .axis-label {
                    font-family: monospace;
                    font-weight: bold;
                    text-shadow: 1px 1px 2px black;
                }
                .save-btn {
                    transition: all 0.2s;
                    cursor: pointer;
                }
                .save-btn:hover {
                    transform: scale(1.1);
                    filter: brightness(1.2);
                }
                /* Toast Animation */
                @keyframes slide-up {
                    from { transform: translate(-50%, 100%); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
            `}</style>

            {/* Android-style Toast Message */}
            {toastMessage && (
                <div 
                    className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-full shadow-lg z-[100] font-medium border border-gray-600"
                    style={{ animation: 'slide-up 0.3s ease-out' }}
                >
                    {toastMessage}
                </div>
            )}

            {/* 3D Canvas & Top-Right Buttons Wrapper */}
            <div className="relative flex-grow h-full" style={{ touchAction: 'none' }}> {/* Android Touch Optimization */}
                <div ref={mountRef} className="w-full h-full cursor-move" />
                
                <div className={`absolute top-4 z-50 flex gap-2 transition-all duration-300 ${showPanel ? 'right-4 md:right-[22rem]' : 'right-4'}`}>
                    <button 
                        onClick={handleSave3D}
                        className="text-2xl save-btn p-2 bg-black/30 rounded-full hover:bg-black/50 backdrop-blur-sm"
                        title="Save 3D Image"
                    >
                        💾
                    </button>
                    <button 
                        onClick={() => setShowPanel(!showPanel)}
                        className="text-2xl save-btn p-2 bg-black/30 rounded-full hover:bg-black/50 backdrop-blur-sm"
                        title="Toggle Controls"
                    >
                        ⚙️
                    </button>
                </div>
            </div>

            {/* 2D Subset Window (Draggable) */}
            {show2D && (
                <div 
                    className="subset-window rounded-lg flex flex-col z-20"
                    style={{ 
                        left: windowPos.x, 
                        top: windowPos.y, 
                        width: '20rem', 
                        height: '22rem',
                        backgroundColor: bgColor, 
                        opacity: 0.95 
                    }}
                >
                    {/* Header */}
                    <div 
                        className="p-3 border-b border-gray-700 bg-gray-800/80 rounded-t-lg flex justify-between items-center cursor-move select-none touch-none"
                        onMouseDown={handleMouseDown}
                        onTouchStart={handleTouchStart}
                    >
                        <div className="flex flex-col">
                            <h3 className="text-sm font-bold text-blue-300">2D Section View</h3>
                            <span className="text-[10px] text-gray-400">Plane: ({h} {k} {l})</span>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                             <span className="text-xs text-gray-500">{atoms2D.length} atoms</span>
                             <button 
                                onClick={handleSave2D}
                                className="text-lg save-btn"
                                title="Save 2D Image"
                            >
                                💾
                            </button>
                        </div>
                    </div>

                    <div className="flex-grow relative overflow-hidden flex items-center justify-center rounded-b-lg">
                        {atoms2D.length === 0 ? (
                            <div className="text-gray-500 text-xs">No atoms on plane</div>
                        ) : (
                            <svg ref={svgRef} viewBox="-200 -200 400 400" className="w-full h-full pointer-events-none">
                                <defs>
                                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse" x="-200" y="-200">
                                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#555" strokeWidth="1"/>
                                    </pattern>
                                </defs>
                                {/* Grid visibility */}
                                {showGrid && <rect x="-200" y="-200" width="400" height="400" fill="url(#grid)" />}

                                {/* Axis visibility */}
                                {showAxis && planeBasis && (
                                    <>
                                        <line x1="-180" y1="180" x2="180" y2="180" stroke="#ef4444" strokeWidth="2" opacity="0.8" />
                                        <polygon points="180,180 175,177 175,183" fill="#ef4444" opacity="0.8" />
                                        <text x="180" y="195" fill="#ef4444" fontSize="12" className="axis-label" textAnchor="end">{planeBasis.uLabel}</text>

                                        <line x1="-180" y1="180" x2="-180" y2="-180" stroke="#22c55e" strokeWidth="2" opacity="0.8" />
                                        <polygon points="-180,-180 -183,-175 -177,-175" fill="#22c55e" opacity="0.8" />
                                        <text x="-180" y="-185" fill="#22c55e" fontSize="12" className="axis-label" textAnchor="middle">{planeBasis.vLabel}</text>

                                        <line x1="-180" y1="180" x2="180" y2="-180" stroke="#eab308" strokeWidth="1.5" strokeDasharray="4,2" opacity="0.8" />
                                        <polygon points="180,-180 174,-178 178,-174" fill="#eab308" opacity="0.8" />
                                        <text x="180" y="-185" fill="#eab308" fontSize="12" className="axis-label" textAnchor="end">{planeBasis.diagLabel}</text>
                                    </>
                                )}
                                
                                {/* Atoms - Updated for Dynamic Cross Section & Opacity */}
                                {atoms2D.map((atom) => (
                                    <circle 
                                        key={atom.id}
                                        cx={atom.u} 
                                        cy={-atom.v}
                                        r={atom.r} // Use calculated radius
                                        fill={atomColor} 
                                        stroke="#3b82f6"
                                        strokeWidth="1"
                                        fillOpacity={atom.opacity} // Use calculated opacity
                                    />
                                ))}
                            </svg>
                        )}
                    </div>
                </div>
            )}

            {/* Collapsible Control Panel (Right Side Panel) */}
            <div 
                className={`absolute bottom-0 right-0 w-full md:w-80 control-panel p-6 text-sm h-1/2 md:h-full overflow-y-auto border-t md:border-l border-gray-700 shadow-2xl z-10 
                ${showPanel ? 'translate-x-0 translate-y-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'}`}
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-blue-400">Controls</h2>
                    {/* Close button for panel (Mobile) */}
                    <button onClick={() => setShowPanel(false)} className="text-gray-400 hover:text-white md:hidden ml-2 text-xl">
                        ✕
                    </button>
                </div>
                
                <div className="mb-6 space-y-4">
                    <h3 className="font-semibold text-gray-300 border-b border-gray-600 pb-2">Miller Indices (h k l)</h3>
                    <div className="flex items-center justify-between">
                        <label className="w-8 font-mono text-yellow-400 font-bold">h: {h}</label>
                        <input type="range" min="-3" max="3" step="1" value={h} onChange={(e) => setH(Number(e.target.value))} className="w-full ml-4" />
                    </div>
                    <div className="flex items-center justify-between">
                        <label className="w-8 font-mono text-yellow-400 font-bold">k: {k}</label>
                        <input type="range" min="-3" max="3" step="1" value={k} onChange={(e) => setK(Number(e.target.value))} className="w-full ml-4" />
                    </div>
                    <div className="flex items-center justify-between">
                        <label className="w-8 font-mono text-yellow-400 font-bold">l: {l}</label>
                        <input type="range" min="-3" max="3" step="1" value={l} onChange={(e) => setL(Number(e.target.value))} className="w-full ml-4" />
                    </div>
                </div>

                <div className="mb-6 space-y-4">
                    <h3 className="font-semibold text-gray-300 border-b border-gray-600 pb-2">Plane Options</h3>
                    <div className="flex flex-col">
                        <div className="flex justify-between mb-1">
                            <span>Offset</span>
                            <span>{offset}</span>
                        </div>
                        <input type="range" min="-20" max="20" step="0.5" value={offset} onChange={(e) => setOffset(Number(e.target.value))} className="w-full" />
                    </div>
                    <div className="flex flex-col">
                        <div className="flex justify-between mb-1">
                            <span>Opacity</span>
                            <span>{Math.round(opacity * 100)}%</span>
                        </div>
                        <input type="range" min="0" max="1" step="0.1" value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="w-full" />
                    </div>
                </div>

                {/* Color Options Section */}
                <div className="mb-6 space-y-4">
                    <h3 className="font-semibold text-gray-300 border-b border-gray-600 pb-2">Color Options</h3>
                    
                    {/* Compact Color Triggers */}
                    <div className="flex justify-around items-center">
                        {/* Atom Color Trigger */}
                        <div className="flex flex-col items-center cursor-pointer" onClick={() => setActiveColorPicker(activeColorPicker === 'atom' ? null : 'atom')}>
                            <span className="text-xs text-gray-400 mb-1">Atom</span>
                            <div className="w-8 h-8 rounded-full border-2 border-gray-500 shadow-md" style={{ backgroundColor: atomColor }} />
                        </div>
                        {/* Bond Color Trigger */}
                        <div className="flex flex-col items-center cursor-pointer" onClick={() => setActiveColorPicker(activeColorPicker === 'bond' ? null : 'bond')}>
                            <span className="text-xs text-gray-400 mb-1">Bond</span>
                            <div className="w-8 h-8 rounded-full border-2 border-gray-500 shadow-md" style={{ backgroundColor: bondColor }} />
                        </div>
                        {/* Plane Color Trigger */}
                        <div className="flex flex-col items-center cursor-pointer" onClick={() => setActiveColorPicker(activeColorPicker === 'plane' ? null : 'plane')}>
                            <span className="text-xs text-gray-400 mb-1">Plane</span>
                            <div className="w-8 h-8 rounded-full border-2 border-gray-500 shadow-md" style={{ backgroundColor: planeColor }} />
                        </div>
                        {/* BG Color Trigger */}
                        <div className="flex flex-col items-center cursor-pointer" onClick={() => setActiveColorPicker(activeColorPicker === 'bg' ? null : 'bg')}>
                            <span className="text-xs text-gray-400 mb-1">BG</span>
                            <div className="w-8 h-8 rounded-full border-2 border-gray-500 shadow-md" style={{ backgroundColor: bgColor }} />
                        </div>
                    </div>

                    {/* Expandable Palette - Modified to 4x2 Grid */}
                    {activeColorPicker && (
                        <div className="bg-gray-800 p-3 rounded-lg mt-2 animate-fade-in border border-gray-600">
                            <div className="text-xs text-center text-blue-300 mb-2 font-bold">
                                Select {activeColorPicker === 'bg' ? 'Background' : activeColorPicker.charAt(0).toUpperCase() + activeColorPicker.slice(1)} Color
                            </div>
                            <div className="grid grid-cols-4 gap-2 place-items-center">
                                {COLOR_PALETTE.map((c) => (
                                    <button
                                        key={c.hex}
                                        onClick={() => {
                                            if (activeColorPicker === 'atom') setAtomColor(c.hex);
                                            else if (activeColorPicker === 'bond') setBondColor(c.hex);
                                            else if (activeColorPicker === 'plane') setPlaneColor(c.hex);
                                            else if (activeColorPicker === 'bg') setBgColor(c.hex);
                                            setActiveColorPicker(null); // Close after select
                                        }}
                                        className="w-8 h-8 rounded-full border border-gray-500 hover:scale-110 transition-transform shadow-sm"
                                        style={{ backgroundColor: c.hex }}
                                        title={c.name}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="mb-6 space-y-4">
                    <h3 className="font-semibold text-gray-300 border-b border-gray-600 pb-2">Misc. Options</h3>
                    
                    <div className="flex flex-col space-y-2">
                        <label className="flex items-center cursor-pointer hover:text-blue-300 transition-colors">
                            <input type="checkbox" checked={showBonds} onChange={(e) => setShowBonds(e.target.checked)} className="mr-2 w-4 h-4 accent-blue-500" />
                            Show Bonds
                        </label>
                        <label className="flex items-center cursor-pointer hover:text-blue-300 transition-colors">
                            <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} className="mr-2 w-4 h-4 accent-blue-500" />
                            Show Grid
                        </label>
                        <label className="flex items-center cursor-pointer hover:text-blue-300 transition-colors">
                            <input type="checkbox" checked={showAxis} onChange={(e) => setShowAxis(e.target.checked)} className="mr-2 w-4 h-4 accent-blue-500" />
                            Show Axis
                        </label>
                        <label className="flex items-center cursor-pointer hover:text-blue-300 transition-colors">
                            <input type="checkbox" checked={showBelowOnly} onChange={(e) => setShowBelowOnly(e.target.checked)} className="mr-2 w-4 h-4 accent-blue-500" />
                            Show Below Only
                        </label>
                        <label className="flex items-center cursor-pointer hover:text-blue-300 transition-colors">
                            <input type="checkbox" checked={show2D} onChange={(e) => setShow2D(e.target.checked)} className="mr-2 w-4 h-4 accent-blue-500" />
                            Show 2D View
                        </label>
                    </div>

                    <div className="flex flex-col mt-4">
                        <div className="flex justify-between mb-1">
                            <span>Structure Size (NxNxN)</span>
                            <span>{structureSize}x{structureSize}x{structureSize}</span>
                        </div>
                        <input type="range" min="2" max="6" step="1" value={structureSize} onChange={(e) => setStructureSize(Number(e.target.value))} className="w-full" />
                    </div>

                    <div className="flex flex-col mt-2">
                        <div className="flex justify-between mb-1">
                            <span>Atom Size</span>
                            <span>{atomSize}</span>
                        </div>
                        <input 
                            type="range" 
                            min="3" 
                            max="10" // Changed from 8.6 to 10
                            step="0.5" 
                            value={atomSize} 
                            onChange={(e) => setAtomSize(Number(e.target.value))} 
                            className="w-full" 
                        />
                    </div>
                </div>

                <button onClick={() => {
                    setH(1); setK(1); setL(1); setOffset(0);
                    if(controlsRef.current) controlsRef.current.reset();
                }} className="w-full py-2 bg-red-600 hover:bg-red-700 rounded text-white font-bold transition-colors shadow-lg">
                    Reset View
                </button>
                
                <div className="mt-8 text-xs text-gray-500 space-y-1">
                    <p>• Left Click / 1-Finger: Rotate (회전)</p>
                    <p>• Right Click / 2-Finger: Pan (이동)</p>
                    <p>• Scroll / Pinch: Zoom (확대/축소)</p>
                    <div className="mt-2 pt-2 border-t border-gray-700">
                        <p className="text-blue-300">■ Blue: Miller Plane</p>
                        <p className="text-gray-300">● White: Silicon Atoms</p>
                        <p>sjoo.hwang@samsung.com DeviceSRAMlab2</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
