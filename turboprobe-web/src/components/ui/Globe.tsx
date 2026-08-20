import React, { useEffect, useRef, useState, type CSSProperties } from "react";
import {
    Scene,
    PerspectiveCamera,
    WebGLRenderer,
    SphereGeometry,
    MeshBasicMaterial,
    Color,
    Mesh,
    Group,
    InstancedMesh,
    Matrix4,
} from "three";
import { geoEquirectangular, geoPath } from "d3-geo";

type Rgba = { r: number; g: number; b: number; a: number };

function parseColorToRgba(input: string): Rgba {
    if (!input || input.trim() === "") return { r: 0, g: 0, b: 0, a: 0 };
    const str = input.trim();
    const rgbaMatch = str.match(
        /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/i
    );
    if (rgbaMatch) {
        const r = Math.max(0, Math.min(255, parseFloat(rgbaMatch[1]))) / 255;
        const g = Math.max(0, Math.min(255, parseFloat(rgbaMatch[2]))) / 255;
        const b = Math.max(0, Math.min(255, parseFloat(rgbaMatch[3]))) / 255;
        const a =
            rgbaMatch[4] !== undefined
                ? Math.max(0, Math.min(1, parseFloat(rgbaMatch[4])))
                : 1;
        return { r, g, b, a };
    }
    const hex = str.replace(/^#/, "");
    if (hex.length === 8) {
        return {
            r: parseInt(hex.slice(0, 2), 16) / 255,
            g: parseInt(hex.slice(2, 4), 16) / 255,
            b: parseInt(hex.slice(4, 6), 16) / 255,
            a: parseInt(hex.slice(6, 8), 16) / 255,
        };
    }
    if (hex.length === 6) {
        return {
            r: parseInt(hex.slice(0, 2), 16) / 255,
            g: parseInt(hex.slice(2, 4), 16) / 255,
            b: parseInt(hex.slice(4, 6), 16) / 255,
            a: 1,
        };
    }
    return { r: 0, g: 0, b: 0, a: 1 };
}

function mapLinear(
    value: number,
    inMin: number,
    inMax: number,
    outMin: number,
    outMax: number
): number {
    if (inMax === inMin) return outMin;
    const t = (value - inMin) / (inMax - inMin);
    return outMin + t * (outMax - outMin);
}

function mapSpeedUiToInternal(ui: number): number {
    if (ui === 0) return 0;
    const clamped = Math.max(0, Math.min(10, ui));
    return mapLinear(clamped, 0, 10, 0, 0.9);
}
function mapDensityUiToSpacing(ui: number): number {
    const clamped = Math.max(1, Math.min(10, ui));
    return mapLinear(clamped, 1, 10, 24, 8);
}
function mapScaleUiToMultiplier(ui: number): number {
    const clamped = Math.max(1, Math.min(20, ui));
    return mapLinear(clamped, 1, 20, 0.2, 2);
}
function mapDotSizeUiToMultiplier(ui: number): number {
    const clamped = Math.max(1, Math.min(10, ui));
    return mapLinear(clamped, 1, 10, 0.1, 0.5);
}
function mapMarkerDotSizeUiToMultiplier(ui: number): number {
    const clamped = Math.max(0, Math.min(100, ui));
    return mapLinear(clamped, 0, 100, 0.1, 2.5);
}
function normalizeSmoothing(ui: number): number {
    return Math.max(0, Math.min(1, ui / 10));
}
function mapDragSpeedUiToSensitivity(ui: number): number {
    return mapLinear(Math.max(0, Math.min(10, ui)), 0, 10, 0.001, 0.02);
}

function latLngToPosition(
    lat: number,
    lng: number
): { x: number; y: number; z: number } {
    const latRad = lat * (Math.PI / 180);
    const lngRad = lng * (Math.PI / 180);
    const x = Math.cos(latRad) * Math.sin(lngRad);
    const y = Math.sin(latRad);
    const z = Math.cos(latRad) * Math.cos(lngRad);
    return { x, y, z };
}

export interface Marker {
    lat: number;
    lng: number;
}
export interface MarkerConfig {
    markers: Marker[];
    color: string;
    size: number;
}
export interface DotsConfig {
    color: string;
    size: number;
    density: number;
    allDots: boolean;
}
export interface GlobeProps {
    speed?: number;
    smoothing?: number;
    dots?: DotsConfig;
    scale?: number;
    markerConfig?: MarkerConfig;
    direction?: "left" | "right";
    initialLatitude?: number;
    initialLongitude?: number;
    oceanColor?: string;
    dragSpeed?: number;
    style?: CSSProperties;
    className?: string;
}

const GlobeComponent = ({
    speed = 1.2,
    smoothing = 8,
    dots = { color: "#ffffff", size: 4, density: 7, allDots: false },
    scale = 8.5,
    markerConfig = { markers: [], color: "#ffffff", size: 35 },
    direction = "left",
    initialLatitude = 15,
    initialLongitude = -20,
    oceanColor = "#00000000",
    dragSpeed = 5,
    style,
    className,
}: GlobeProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [, setIsLoading] = useState(true);

    const dotColor = dots.color;
    const dotSize = dots.size;
    const density = dots.density;
    const allDots = dots.allDots;
    const smoothingN = normalizeSmoothing(smoothing);

    const baseRotationSpeed = mapSpeedUiToInternal(speed);
    const rotationSpeed = direction === "left" ? -baseRotationSpeed : baseRotationSpeed;
    const dotSpacing = mapDensityUiToSpacing(density);
    const dotSizeMultiplier = mapDotSizeUiToMultiplier(dotSize);
    const markerRadiusMultiplier = mapMarkerDotSizeUiToMultiplier(markerConfig.size);
    const scaleMultiplier = mapScaleUiToMultiplier(scale);

    useEffect(() => {
        if (!containerRef.current) return;
        const container = containerRef.current;
        const containerWidth = container.clientWidth || container.offsetWidth || 800;
        const containerHeight = container.clientHeight || container.offsetHeight || 600;

        const scene = new Scene();
        const camera = new PerspectiveCamera(50, containerWidth / containerHeight, 0.1, 1000);
        const baseRadius = 1;
        const globeRadius = baseRadius * scaleMultiplier;
        const cameraDistance = 2.5 / scaleMultiplier;
        camera.position.set(0, 0, cameraDistance);
        camera.lookAt(0, 0, 0);

        const renderer = new WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(containerWidth, containerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = "srgb";
        const canvas = renderer.domElement;
        canvas.style.position = "absolute";
        canvas.style.inset = "0";
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.display = "block";
        canvas.style.opacity = "0";
        canvas.style.transition = "opacity 0.6s ease";
        container.appendChild(canvas);

        const oceanRgba = parseColorToRgba(oceanColor);
        const dotRgba = parseColorToRgba(dotColor);

        const oceanGeometry = new SphereGeometry(globeRadius, 48, 48);
        const oceanMaterial = new MeshBasicMaterial({
            color: new Color(0, 0, 0),
            transparent: true,
            opacity: oceanRgba.a,
        });
        const oceanMesh = new Mesh(oceanGeometry, oceanMaterial);
        scene.add(oceanMesh);

        const globeGroup = new Group();
        const initialLongitudeRad = (initialLongitude * Math.PI) / 180;
        const initialLatitudeRad = (initialLatitude * Math.PI) / 180;
        globeGroup.rotation.y = initialLongitudeRad;
        globeGroup.rotation.x = initialLatitudeRad;
        scene.add(globeGroup);
        globeGroup.add(oceanMesh);

        let dotInstances: InstancedMesh | Mesh | null = null;
        let markerMeshes: Mesh[] = [];

        const loadWorldData = async () => {
            try {
                setIsLoading(true);
                const response = await fetch(
                    "https://raw.githubusercontent.com/martynafford/natural-earth-geojson/refs/heads/master/50m/physical/ne_50m_land.json"
                );
                if (!response.ok) return;
                const landFeatures = await response.json();

                const bitmapWidth = 2048;
                const bitmapHeight = 1024;
                const offscreenCanvas = document.createElement("canvas");
                offscreenCanvas.width = bitmapWidth;
                offscreenCanvas.height = bitmapHeight;
                const ctx = offscreenCanvas.getContext("2d", { willReadFrequently: true });
                if (!ctx) return;

                const projection = geoEquirectangular().fitSize([bitmapWidth, bitmapHeight], { type: "Sphere" } as any);
                const pathGenerator = geoPath().projection(projection).context(ctx);
                ctx.fillStyle = "#000";
                ctx.fillRect(0, 0, bitmapWidth, bitmapHeight);
                ctx.fillStyle = "#fff";
                ctx.beginPath();
                landFeatures.features.forEach((feature: any) => {
                    pathGenerator(feature);
                });
                ctx.fill();

                const imageData = ctx.getImageData(0, 0, bitmapWidth, bitmapHeight);
                const pixels = imageData.data;
                const isOnLand = (lng: number, lat: number) => {
                    const x = Math.round(((lng + 180) / 360) * bitmapWidth) % bitmapWidth;
                    const y = Math.round(((90 - lat) / 180) * bitmapHeight);
                    const clampedY = Math.max(0, Math.min(bitmapHeight - 1, y));
                    const idx = (clampedY * bitmapWidth + x) * 4;
                    return pixels[idx] > 128;
                };

                const dotCoordinates: number[][] = [];
                const baseStep = dotSpacing * 0.08;
                for (let lat = -90; lat <= 90; lat += baseStep) {
                    const latRad = (Math.abs(lat) * Math.PI) / 180;
                    const cosLat = Math.cos(latRad);
                    const lngStep = cosLat > 0.01 ? baseStep / Math.max(0.3, cosLat) : 360;
                    for (let lng = -180; lng < 180; lng += lngStep) {
                        if (allDots || isOnLand(lng, lat)) {
                            dotCoordinates.push([lng, lat]);
                        }
                    }
                }

                if (dotCoordinates.length > 0) {
                    const dotGeometry = new SphereGeometry(0.01 * dotSizeMultiplier, 4, 4);
                    const dotMaterial = new MeshBasicMaterial({
                        color: new Color(dotColor),
                        transparent: dotRgba.a < 1,
                        opacity: dotRgba.a,
                    });
                    const instanced = new InstancedMesh(dotGeometry, dotMaterial, dotCoordinates.length);
                    const matrix = new Matrix4();
                    for (let i = 0; i < dotCoordinates.length; i++) {
                        const [lng, lat] = dotCoordinates[i];
                        const pos = latLngToPosition(lat, lng);
                        matrix.makeScale(1, 1, 1);
                        matrix.setPosition(pos.x * globeRadius, pos.y * globeRadius, pos.z * globeRadius);
                        instanced.setMatrixAt(i, matrix);
                    }
                    instanced.instanceMatrix.needsUpdate = true;
                    dotInstances = instanced;
                    globeGroup.add(dotInstances);
                }

                // Add Markers
                if (markerConfig.markers && markerConfig.markers.length > 0) {
                    const markerSize = 0.01 * markerRadiusMultiplier;
                    const markerGeometry = new SphereGeometry(markerSize, 12, 12);
                    const markerMaterial = new MeshBasicMaterial({ color: new Color(markerConfig.color) });
                    markerConfig.markers.forEach((marker) => {
                        const pos = latLngToPosition(marker.lat, marker.lng);
                        const markerMesh = new Mesh(markerGeometry, markerMaterial.clone());
                        markerMesh.position.set(pos.x * globeRadius, pos.y * globeRadius, pos.z * globeRadius);
                        globeGroup.add(markerMesh);
                        markerMeshes.push(markerMesh);
                    });
                }

                renderer.render(scene, camera);
                canvas.style.opacity = "1";
                setIsLoading(false);
            } catch (_) {
                setIsLoading(false);
            }
        };

        const rotation = { x: initialLongitudeRad, y: initialLatitudeRad };
        const targetRotation = { x: initialLongitudeRad, y: initialLatitudeRad };
        const velocity = { x: 0, y: 0 };
        let isDragging = false;
        let lastMouseX = 0;
        let lastMouseY = 0;
        let animationFrameId: number | null = null;
        const lerpFactor = smoothingN === 0 ? 1 : mapLinear(smoothingN, 0, 1, 0.4, 0.03);
        const velocityDecay = mapLinear(smoothingN, 0, 1, 0.7, 0.96);

        const animate = () => {
            let needsRender = false;
            const threshold = 0.001;

            if (!isDragging && rotationSpeed !== 0) {
                targetRotation.x += rotationSpeed * 0.01;
            }

            if (!isDragging && smoothingN > 0) {
                if (Math.abs(velocity.x) > threshold || Math.abs(velocity.y) > threshold) {
                    targetRotation.x += velocity.x;
                    targetRotation.y += velocity.y;
                    targetRotation.y = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetRotation.y));
                    velocity.x *= velocityDecay;
                    velocity.y *= velocityDecay;
                } else {
                    velocity.x = 0;
                    velocity.y = 0;
                }
            }

            const dx = targetRotation.x - rotation.x;
            const dy = targetRotation.y - rotation.y;
            if (Math.abs(dx) > threshold || Math.abs(dy) > threshold || rotationSpeed !== 0 || isDragging) {
                rotation.x += dx * lerpFactor;
                rotation.y += dy * lerpFactor;
                rotation.y = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotation.y));
                needsRender = true;
            }

            if (needsRender || rotationSpeed !== 0 || isDragging) {
                globeGroup.rotation.y = rotation.x;
                globeGroup.rotation.x = rotation.y;
                renderer.render(scene, camera);
            }

            animationFrameId = requestAnimationFrame(animate);
        };

        animationFrameId = requestAnimationFrame(animate);

        const handleMouseDown = (event: MouseEvent) => {
            isDragging = true;
            velocity.x = 0;
            velocity.y = 0;
            lastMouseX = event.clientX;
            lastMouseY = event.clientY;
            const handleMouseMoveDrag = (moveEvent: MouseEvent) => {
                const sensitivity = mapDragSpeedUiToSensitivity(dragSpeed);
                const dx = moveEvent.clientX - lastMouseX;
                const dy = moveEvent.clientY - lastMouseY;
                targetRotation.x += dx * sensitivity;
                targetRotation.y += dy * sensitivity;
                targetRotation.y = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetRotation.y));
                velocity.x = dx * sensitivity * 0.3;
                velocity.y = dy * sensitivity * 0.3;
                lastMouseX = moveEvent.clientX;
                lastMouseY = moveEvent.clientY;
            };
            const handleMouseUp = () => {
                document.removeEventListener("mousemove", handleMouseMoveDrag);
                document.removeEventListener("mouseup", handleMouseUp);
                isDragging = false;
            };
            document.addEventListener("mousemove", handleMouseMoveDrag);
            document.addEventListener("mouseup", handleMouseUp);
        };
        canvas.addEventListener("mousedown", handleMouseDown);

        const resizeObserver = new ResizeObserver(() => {
            const newWidth = container.clientWidth || container.offsetWidth || 800;
            const newHeight = container.clientHeight || container.offsetHeight || 600;
            camera.aspect = newWidth / newHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(newWidth, newHeight);
            const newCameraDistance = 2.5 / scaleMultiplier;
            camera.position.set(0, 0, newCameraDistance);
            camera.lookAt(0, 0, 0);
            renderer.render(scene, camera);
        });
        resizeObserver.observe(container);

        loadWorldData();

        return () => {
            if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
            canvas.removeEventListener("mousedown", handleMouseDown);
            resizeObserver.disconnect();
            renderer.dispose();
            container.removeChild(canvas);
        };
    }, []);

    const containerStyle: CSSProperties = {
        ...style,
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    };

    return <div ref={containerRef} className={className} style={containerStyle} />;
};

export const Globe = React.memo(GlobeComponent);
export default Globe;
