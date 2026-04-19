import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

function buildTreeData(people) {
  const familyByUnion = {};
  const personToFamily = {};

  people.forEach(p => {
    const id = String(p.id); 
    const famId = `fam-${id}`;
    
    familyByUnion[famId] = { id: famId, parents: [p], children: [] };
    personToFamily[id] = familyByUnion[famId];
  });

  people.forEach(p => {
    const partners = Array.from(new Set([
      p.spouse,
      p.husband,
      p.wife,
      ...(Array.isArray(p.partners) ? p.partners : []),
    ].filter(Boolean).map(String)));
    partners.forEach(partnerId => {
      const myId = String(p.id);
      const myFam = personToFamily[myId];
      const spouseFam = personToFamily[partnerId];
      
      if (myFam && spouseFam && myFam.id !== spouseFam.id) {
        const newFamId = `union-${myId}-${partnerId}`;
        const mergedParents = Array.from(new Set([...myFam.parents, ...spouseFam.parents]));
        const mergedFam = {
          id: newFamId,
          parents: mergedParents,
          children: [...myFam.children, ...spouseFam.children]
        };
        familyByUnion[newFamId] = mergedFam;
        mergedParents.forEach(parent => { personToFamily[String(parent.id)] = mergedFam; });
        delete familyByUnion[myFam.id];
        delete familyByUnion[spouseFam.id];
      }
    });
  });

  people.forEach(p => {
    const parentIds = Array.from(new Set([
      p.mother,
      p.father,
      p.adoptive_mother,
      p.adoptive_father,
    ].filter(Boolean).map(String)));

    if (parentIds.length < 2) return;

    const existingFamilies = parentIds
      .map(parentId => personToFamily[parentId])
      .filter(Boolean);
    if (existingFamilies.length < 2) return;

    const uniqueFamilies = Array.from(new Set(existingFamilies.map(family => family.id))).map(
      familyId => familyByUnion[familyId] || existingFamilies.find(family => family.id === familyId),
    ).filter(Boolean);

    if (uniqueFamilies.length < 2) return;

    const newFamId = `parents-${parentIds.join('-')}`;
    const mergedParents = Array.from(new Map(uniqueFamilies.flatMap(family => family.parents).map(parent => [String(parent.id), parent])).values());
    const mergedChildren = Array.from(new Set(uniqueFamilies.flatMap(family => family.children)));
    const mergedFam = {
      id: newFamId,
      parents: mergedParents,
      children: mergedChildren,
    };

    familyByUnion[newFamId] = mergedFam;
    mergedParents.forEach(parent => { personToFamily[String(parent.id)] = mergedFam; });
    uniqueFamilies.forEach(family => {
      delete familyByUnion[family.id];
    });
  });

  const extraLinks = [];
  people.forEach(p => {
    const childId = String(p.id);
    const childFam = personToFamily[childId];
    if (!childFam) return;

    const parentIds = Array.from(new Set([
      p.mother,
      p.father,
      p.adoptive_mother,
      p.adoptive_father,
    ].filter(Boolean).map(String)));

    parentIds.forEach((parentId, index) => {
      const parentFam = personToFamily[parentId];
      if (!parentFam || parentFam.id === childFam.id) return;

      if (!childFam.hasParentFamily) {
        parentFam.children.push(childFam);
        childFam.hasParentFamily = true;
        childFam.primaryParentFamId = parentFam.id;
      } else if (childFam.primaryParentFamId !== parentFam.id) {
        const isPrimary = index === 0;
        extraLinks.push({ sourceFam: parentFam.id, targetFam: childFam.id, isPrimary });
      }
    });
  });

  const rootFamilies = Object.values(familyByUnion).filter(fam => !fam.hasParentFamily);

  return { isVirtual: true, id: "Root", children: rootFamilies, extraLinks };
}

function drawNodeShape(group, opts) {
  const { shape, radius, fill, stroke, strokeWidth, filter } = opts;

  if (shape === 'capsule') {
    const width = radius * 2.4;
    const height = radius * 1.45;
    const corner = height / 2;

    group.append('rect')
      .attr('x', -width / 2)
      .attr('y', -height / 2)
      .attr('width', width)
      .attr('height', height)
      .attr('rx', corner)
      .attr('ry', corner)
      .attr('fill', fill)
      .attr('stroke', stroke)
      .attr('stroke-width', strokeWidth)
      .style('filter', filter);
    return;
  }

  if (shape === 'hexagon') {
    const hexPoints = [
      [-radius * 0.9, 0],
      [-radius * 0.45, -radius * 0.78],
      [radius * 0.45, -radius * 0.78],
      [radius * 0.9, 0],
      [radius * 0.45, radius * 0.78],
      [-radius * 0.45, radius * 0.78],
    ].map(([x, y]) => `${x},${y}`).join(' ');

    group.append('polygon')
      .attr('points', hexPoints)
      .attr('fill', fill)
      .attr('stroke', stroke)
      .attr('stroke-width', strokeWidth)
      .style('filter', filter);
    return;
  }

  if (shape === 'square' || shape === 'rounded') {
    group.append('rect')
      .attr('x', -radius)
      .attr('y', -radius)
      .attr('width', radius * 2)
      .attr('height', radius * 2)
      .attr('rx', shape === 'rounded' ? 18 : 2)
      .attr('ry', shape === 'rounded' ? 18 : 2)
      .attr('fill', fill)
      .attr('stroke', stroke)
      .attr('stroke-width', strokeWidth)
      .style('filter', filter);
    return;
  }

  if (shape === 'diamond') {
    const points = `0,${-radius} ${radius},0 0,${radius} ${-radius},0`;
    group.append('polygon')
      .attr('points', points)
      .attr('fill', fill)
      .attr('stroke', stroke)
      .attr('stroke-width', strokeWidth)
      .style('filter', filter);
    return;
  }

  group.append('circle')
    .attr('r', radius)
    .attr('fill', fill)
    .attr('stroke', stroke)
    .attr('stroke-width', strokeWidth)
    .style('filter', filter);
}

function createNameSprite(text, options = {}) {
  const {
    fontSize = 70,
    subtitle = '',
    textColor = '#000000',
    subtitleColor = '#111827',
    background = 'rgba(255, 255, 255, 0.98)',
    borderColor = 'rgba(31, 41, 55, 0.45)',
  } = options;

  const label = (text || '').trim() || 'Unnamed';
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 384;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    const fallbackMaterial = new THREE.SpriteMaterial({ color: 0xffffff });
    const fallbackSprite = new THREE.Sprite(fallbackMaterial);
    fallbackSprite.scale.set(240, 76, 1);
    return fallbackSprite;
  }

  const subtitleText = (subtitle || '').trim();
  const words = label.split(/\s+/).filter(Boolean);
  const wrapIntoLines = (maxWidth) => {
    const lines = [];
    let current = '';

    words.forEach((word) => {
      const candidate = current ? `${current} ${word}` : word;
      if (!current || ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    });

    if (current) {
      lines.push(current);
    }

    return lines.length > 0 ? lines : [label];
  };

  ctx.font = `800 ${fontSize}px "Segoe UI", Arial, sans-serif`;
  const fullMeasure = ctx.measureText(label).width;
  const maxWordWidth = words.reduce((acc, word) => Math.max(acc, ctx.measureText(word).width), 0);

  let targetLineWidth = Math.max(380, Math.min(980, Math.max(maxWordWidth * 1.35, fullMeasure * 0.56)));
  let lines = wrapIntoLines(targetLineWidth);
  if (lines.length > 3) {
    targetLineWidth *= 1.28;
    lines = wrapIntoLines(targetLineWidth);
  }

  const hasSubtitle = Boolean(subtitleText);
  const lineWidths = lines.map(line => ctx.measureText(line).width);
  const subtitleWidth = hasSubtitle ? ctx.measureText(subtitleText).width * 0.9 : 0;
  const contentWidth = Math.max(subtitleWidth, ...lineWidths);

  const width = Math.max(560, Math.min(1680, contentWidth + 360));
  const dynamicHeight = Math.max(220, Math.min(440, 166 + (lines.length * 60) + (hasSubtitle ? 72 : 0)));

  canvas.width = Math.ceil(width);
  canvas.height = Math.ceil(dynamicHeight);

  const innerPadding = 22;
  const x = innerPadding;
  const y = innerPadding;
  const boxWidth = canvas.width - (innerPadding * 2);
  const boxHeight = canvas.height - (innerPadding * 2);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const cornerRadius = Math.min(46, Math.max(20, boxHeight * 0.24));
  ctx.fillStyle = background;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + cornerRadius, y);
  ctx.lineTo(x + boxWidth - cornerRadius, y);
  ctx.quadraticCurveTo(x + boxWidth, y, x + boxWidth, y + cornerRadius);
  ctx.lineTo(x + boxWidth, y + boxHeight - cornerRadius);
  ctx.quadraticCurveTo(x + boxWidth, y + boxHeight, x + boxWidth - cornerRadius, y + boxHeight);
  ctx.lineTo(x + cornerRadius, y + boxHeight);
  ctx.quadraticCurveTo(x, y + boxHeight, x, y + boxHeight - cornerRadius);
  ctx.lineTo(x, y + cornerRadius);
  ctx.quadraticCurveTo(x, y, x + cornerRadius, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowColor = 'rgba(0, 0, 0, 0)';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = textColor;
  ctx.font = `800 ${fontSize}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const textCenterX = canvas.width / 2;
  const textCenterY = canvas.height / 2;
  const lineGap = Math.max(48, fontSize * 0.92);
  const totalTextHeight = lineGap * (lines.length - 1);
  const startY = textCenterY - (totalTextHeight / 2) - (hasSubtitle ? 20 : 2);

  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.98)';
  ctx.lineWidth = 8;

  lines.forEach((line, index) => {
    const yPos = startY + (index * lineGap);
    ctx.strokeText(line, textCenterX, yPos);
    ctx.fillText(line, textCenterX, yPos);
  });

  if (hasSubtitle) {
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.font = `700 ${Math.max(32, fontSize - 18)}px "Segoe UI", Arial, sans-serif`;
    ctx.fillStyle = subtitleColor;
    ctx.fillText(subtitleText, textCenterX, canvas.height - 50);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(material);
  const scaleX = Math.max(220, Math.min(480, canvas.width * 0.28));
  const scaleY = Math.max(82, Math.min(148, 70 + (lines.length * 16) + (hasSubtitle ? 16 : 0)));
  sprite.scale.set(scaleX, scaleY, 1);
  sprite.renderOrder = 999;
  return sprite;
}

function disposeMaterial(material) {
  if (!material) return;

  if (Array.isArray(material)) {
    material.forEach(disposeMaterial);
    return;
  }

  if (material.map) {
    material.map.dispose();
  }
  material.dispose();
}

function disposeSceneGraph(root) {
  root.traverse((child) => {
    if (child.geometry) {
      child.geometry.dispose();
    }

    if (child.material) {
      disposeMaterial(child.material);
    }
  });
}

function createRoundedRectGeometry(width, height, depth, cornerRadius) {
  const w = width / 2;
  const h = height / 2;
  const r = Math.min(cornerRadius, w, h);
  const shape = new THREE.Shape();

  shape.moveTo(-w + r, -h);
  shape.lineTo(w - r, -h);
  shape.quadraticCurveTo(w, -h, w, -h + r);
  shape.lineTo(w, h - r);
  shape.quadraticCurveTo(w, h, w - r, h);
  shape.lineTo(-w + r, h);
  shape.quadraticCurveTo(-w, h, -w, h - r);
  shape.lineTo(-w, -h + r);
  shape.quadraticCurveTo(-w, -h, -w + r, -h);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: Math.max(2, r * 0.22),
    bevelThickness: Math.max(2, depth * 0.16),
    curveSegments: 12,
  });
  geometry.center();
  return geometry;
}

function createNodeGeometry(shape, radius, isCompact = false) {
  if (shape === 'square') {
    return new THREE.BoxGeometry(radius * 1.75, radius * 1.75, radius * 1.2);
  }

  if (shape === 'rounded') {
    return createRoundedRectGeometry(radius * 1.85, radius * 1.85, radius * 1.05, radius * 0.35);
  }

  if (shape === 'diamond') {
    return new THREE.OctahedronGeometry(radius * 1.02, 0);
  }

  if (shape === 'hexagon') {
    return new THREE.CylinderGeometry(radius * 0.96, radius * 0.96, radius * 1.45, 6, 1);
  }

  if (shape === 'capsule') {
    return new THREE.CapsuleGeometry(radius * 0.56, radius * 0.98, isCompact ? 5 : 8, isCompact ? 10 : 16);
  }

  return new THREE.SphereGeometry(radius, isCompact ? 20 : 28, isCompact ? 14 : 20);
}

function renderThreeTree({
  container,
  people,
  onSelect,
  backgroundColor,
  treeOrientation,
  horizontalFlowDirection = 1,
  nodeShape,
  birthdayPersonIds,
  containerSize,
  labelDensityMode = 'all',
  onStructureReady,
  onFocusPersonReady,
}) {
  const width = containerSize.width || container.clientWidth || 1000;
  const height = containerSize.height || container.clientHeight || 700;
  const isCompact = width < 840;
  const adaptiveScale = Math.max(0.72, Math.min(1.06, width / 1180));
  const nodeRadius = 48 * adaptiveScale;
  const familyDensityBoost = Math.max(1, Math.min(1.32, 1 + ((people.length - 24) / 120)));
  const spouseSpacing = 160 * adaptiveScale * familyDensityBoost;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(backgroundColor);

  const camera = new THREE.PerspectiveCamera(52, width / height, 1, 10000);
  camera.position.set(0, 250, 1500);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isCompact ? 1.35 : 2));
  renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.cursor = 'grab';
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = true;
  controls.minDistance = 260;
  controls.maxDistance = 4600;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.rotateSpeed = isCompact ? 0.75 : 1;
  controls.zoomSpeed = isCompact ? 0.85 : 1;
  controls.panSpeed = isCompact ? 0.82 : 1;
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.PAN,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.ROTATE,
  };
  controls.touches = {
    ONE: THREE.TOUCH.PAN,
    TWO: THREE.TOUCH.DOLLY_ROTATE,
  };

  scene.add(new THREE.AmbientLight(0xffffff, 0.78));

  const keyLight = new THREE.DirectionalLight(0xffffff, 0.6);
  keyLight.position.set(550, 900, 650);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xfff1d6, 0.28);
  fillLight.position.set(-700, 360, 280);
  scene.add(fillLight);

  const rimLight = new THREE.PointLight(0xc7e4ff, 0.26, 6000);
  rimLight.position.set(0, -500, 900);
  scene.add(rimLight);

  const sceneGroup = new THREE.Group();
  scene.add(sceneGroup);

  const labelSprites = [];

  const data = buildTreeData(people);
  const nodeWidth = 320 * familyDensityBoost;
  const nodeHeight = 320 * familyDensityBoost;

  const treeLayout = d3.tree().nodeSize([nodeWidth, nodeHeight]);
  const rootD3 = d3.hierarchy(data, d => d.children);
  treeLayout(rootD3);

  const getNodePosition = (node) => {
    if (treeOrientation === 'horizontal') {
      return { x: node.y * horizontalFlowDirection, y: node.x };
    }
    return { x: node.x, y: node.y };
  };

  const nodeMap = {};
  rootD3.descendants().forEach(d => { nodeMap[d.data.id] = d; });

  const extraLinkData = (data.extraLinks || [])
    .map(link => ({ source: nodeMap[link.sourceFam], target: nodeMap[link.targetFam] }))
    .filter(l => l.source && l.target);

  const familyNodes = rootD3.descendants().filter(d => d.depth > 0);
  const familyPositions = new Map();

  familyNodes.forEach((node) => {
    const pos = getNodePosition(node);
    const vector = new THREE.Vector3(
      pos.x * 0.95,
      -pos.y * 0.75,
      (node.depth * 165) + (Math.sin(pos.x / 180) * 75),
    );
    familyPositions.set(node.data.id, vector);
  });

  if (familyPositions.size > 0) {
    const centroid = new THREE.Vector3();
    familyPositions.forEach(v => centroid.add(v));
    centroid.divideScalar(familyPositions.size);
    familyPositions.forEach((v) => v.sub(centroid));
  }

  const addCurvedLink = (sourceVec, targetVec, dashed = false) => {
    const control = sourceVec.clone().add(targetVec).multiplyScalar(0.5);
    control.z += treeOrientation === 'horizontal' ? 130 : 90;

    const curve = new THREE.QuadraticBezierCurve3(sourceVec, control, targetVec);
    const points = curve.getPoints(24);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    let material;
    if (dashed) {
      material = new THREE.LineDashedMaterial({
        color: 0xb9ac95,
        dashSize: 12,
        gapSize: 8,
        transparent: true,
        opacity: 0.95,
      });
    } else {
      material = new THREE.LineBasicMaterial({ color: 0xd1c4ae, transparent: true, opacity: 0.95 });
    }

    const line = new THREE.Line(geometry, material);
    if (dashed) {
      line.computeLineDistances();
    }
    sceneGroup.add(line);
  };

  rootD3.links().filter(l => l.source.depth > 0).forEach((link) => {
    const source = familyPositions.get(link.source.data.id);
    const target = familyPositions.get(link.target.data.id);
    if (source && target) {
      addCurvedLink(source, target, false);
    }
  });

  extraLinkData.forEach((link) => {
    const source = familyPositions.get(link.source.data.id);
    const target = familyPositions.get(link.target.data.id);
    if (source && target) {
      addCurvedLink(source, target, true);
    }
  });

  const clickableMeshes = [];
  const focusAnchors = new Map();
  const structureEntries = [];
  const textureLoader = new THREE.TextureLoader();
  textureLoader.setCrossOrigin('anonymous');
  const baseNodeGeometry = createNodeGeometry(nodeShape, nodeRadius, isCompact);

  familyNodes.forEach((node) => {
    const center = familyPositions.get(node.data.id);
    if (!center) return;

    const parents = node.data.parents || [];
    const isHorizontalLayout = treeOrientation === 'horizontal';
    const spacing = spouseSpacing;
    const startOffset = -((parents.length - 1) * spacing) / 2;
    const parentAnchors = [];

    parents.forEach((person, index) => {
      const isDeceased = Boolean(person.death_date);
      const isBirthdayToday = birthdayPersonIds.has(String(person.id));
      const defaultColor = person.gender === 'M' ? 0x4A90E2 : (person.gender === 'F' ? 0xD0021B : 0x777777);

      const material = new THREE.MeshStandardMaterial({
        color: isDeceased ? 0x8a8a8a : defaultColor,
        metalness: 0.28,
        roughness: 0.42,
      });

      if (isDeceased) {
        material.emissive = new THREE.Color(0x1f1f1f);
        material.emissiveIntensity = 0.16;
      }

      const mesh = new THREE.Mesh(baseNodeGeometry, material);
      const x = isHorizontalLayout ? center.x : center.x + startOffset + (index * spacing);
      const y = isHorizontalLayout ? center.y + (startOffset * 0.62) + (index * spacing * 0.62) : center.y;
      const z = center.z + ((index % 2 === 0 ? -1 : 1) * 30);
      mesh.position.set(x, y, z);
      if (nodeShape === 'diamond') {
        mesh.rotation.z = Math.PI / 4;
      }
      mesh.userData.person = person;
      sceneGroup.add(mesh);
      clickableMeshes.push(mesh);
      parentAnchors.push(mesh.position.clone());

      if (person.photo_url) {
        textureLoader.load(
          person.photo_url,
          (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            material.map = texture;
            material.color.set(0xffffff);
            material.needsUpdate = true;
          },
          undefined,
          () => {},
        );
      }

      if (isBirthdayToday) {
        const halo = new THREE.Mesh(
          new THREE.TorusGeometry(nodeRadius * 1.24, Math.max(2, nodeRadius * 0.065), 20, 72),
          new THREE.MeshStandardMaterial({
            color: 0xf59e0b,
            emissive: 0xf59e0b,
            emissiveIntensity: 0.48,
            metalness: 0.2,
            roughness: 0.34,
          }),
        );
        halo.position.copy(mesh.position);
        halo.rotation.x = Math.PI / 2;
        sceneGroup.add(halo);
      }

      if (isDeceased) {
        const marker = new THREE.Mesh(
          new THREE.OctahedronGeometry(Math.max(8, nodeRadius * 0.2), 0),
          new THREE.MeshStandardMaterial({
            color: 0x111111,
            emissive: 0x2a2a2a,
            emissiveIntensity: 0.42,
            metalness: 0.22,
            roughness: 0.62,
          }),
        );
        marker.position.set(x + (nodeRadius * 0.95), y + (nodeRadius * 0.92), z);
        sceneGroup.add(marker);
      }

      const fullName = `${person.first_name || ''} ${person.last_name || ''}`.trim() || 'Unnamed';
      const personId = String(person.id);
      if (!focusAnchors.has(personId)) {
        focusAnchors.set(personId, { mesh, depth: node.depth, label: fullName });
        structureEntries.push({ id: personId, label: fullName, depth: node.depth, photoUrl: person.photo_url || '' });
      }
      const subtitle = person.birth_date
        ? (() => {
          const birthYear = new Date(person.birth_date).getFullYear();
          const deathYear = isDeceased ? new Date(person.death_date).getFullYear() : null;
          if (!Number.isFinite(birthYear)) return '';
          if (isDeceased && Number.isFinite(deathYear)) {
            return `${birthYear} - ${deathYear}`;
          }
          return `* ${birthYear}`;
        })()
        : '';
      const nameSprite = createNameSprite(fullName, {
        borderColor: isDeceased ? 'rgba(31, 41, 55, 0.5)' : 'rgba(59, 130, 246, 0.38)',
        subtitle: labelDensityMode === 'names-only' ? '' : subtitle,
      });
      const labelSide = index % 2 === 0 ? -1 : 1;
      const labelOffsetX = (nodeRadius * 2.2) + (nameSprite.scale.x * 0.22);
      const labelOffsetY = nodeRadius * 0.12;
      nameSprite.position.set(x + (labelSide * labelOffsetX), y - labelOffsetY, z);
      nameSprite.userData.baseScale = nameSprite.scale.clone();
      nameSprite.userData.depth = node.depth;
      sceneGroup.add(nameSprite);
      labelSprites.push(nameSprite);
    });

    if (parentAnchors.length > 1) {
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        parentAnchors[0],
        parentAnchors[parentAnchors.length - 1],
      ]);
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0xd97c7c, transparent: true, opacity: 0.92 });
      sceneGroup.add(new THREE.Line(lineGeometry, lineMaterial));
    }
  });

  if (typeof onStructureReady === 'function') {
    onStructureReady(structureEntries);
  }

  if (typeof onFocusPersonReady === 'function') {
    onFocusPersonReady((personId) => {
      const anchor = focusAnchors.get(String(personId));
      if (!anchor?.mesh) return;

      const targetPosition = anchor.mesh.getWorldPosition(new THREE.Vector3());
      const viewDistance = Math.max(420, Math.min(1400, camera.position.distanceTo(controls.target) * 0.45));

      const offset = treeOrientation === 'horizontal'
        ? new THREE.Vector3(horizontalFlowDirection * viewDistance * 0.72, viewDistance * 0.18, viewDistance)
        : new THREE.Vector3(0, viewDistance * 0.2, viewDistance);

      camera.position.copy(targetPosition.clone().add(offset));
      controls.target.copy(targetPosition);
      controls.update();
    });
  }

  const treeBounds = new THREE.Box3().setFromObject(sceneGroup);
  if (!treeBounds.isEmpty()) {
    const size = treeBounds.getSize(new THREE.Vector3());
    const center = treeBounds.getCenter(new THREE.Vector3());
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const maxDim = Math.max(size.x, size.y * 1.12, size.z * 1.12);
    const fitDistance = Math.max(900, ((maxDim * 0.62) / Math.tan(fov / 2)));

    controls.target.copy(center);
    controls.minDistance = Math.max(230, fitDistance * 0.28);
    controls.maxDistance = Math.max(5200, fitDistance * 3.3);

    if (treeOrientation === 'horizontal') {
      camera.position.set(
        center.x + (horizontalFlowDirection * fitDistance * 0.54),
        center.y + Math.max(170, size.y * 0.18),
        center.z + (fitDistance * 1.03),
      );
    } else {
      camera.position.set(
        center.x,
        center.y + Math.max(180, size.y * 0.20),
        center.z + (fitDistance * 1.16),
      );
    }
    camera.lookAt(controls.target);
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  const pickMesh = (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(clickableMeshes, false);
  };

  const handlePointerMove = (event) => {
    const intersects = pickMesh(event);
    renderer.domElement.style.cursor = intersects.length > 0 ? 'pointer' : 'grab';
  };

  const handleClick = (event) => {
    const intersects = pickMesh(event);
    const person = intersects[0]?.object?.userData?.person;
    if (person) {
      onSelect(person);
    }
  };

  renderer.domElement.addEventListener('pointermove', handlePointerMove);
  renderer.domElement.addEventListener('click', handleClick);

  let animationFrameId = 0;
  const baseRotation = treeOrientation === 'horizontal' ? -0.2 : 0.05;

  const resizeObserver = new ResizeObserver(() => {
    const resizedWidth = container.clientWidth || width;
    const resizedHeight = container.clientHeight || height;
    camera.aspect = resizedWidth / resizedHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(resizedWidth, resizedHeight, false);
  });
  resizeObserver.observe(container);

  const animate = () => {
    animationFrameId = window.requestAnimationFrame(animate);
    sceneGroup.rotation.y = baseRotation + Math.sin(Date.now() * 0.0002) * 0.045;

    const zoomDistance = camera.position.distanceTo(controls.target);
    const zoomBoost = THREE.MathUtils.clamp(zoomDistance / 1900, 0.95, 2.25);
    const farTreeMode = zoomDistance > 3500;
    const hideDeepMode = labelDensityMode === 'hide-deep';

    labelSprites.forEach((sprite) => {
      const base = sprite.userData.baseScale;
      if (!base) return;

      const hideForDepth = hideDeepMode && sprite.userData.depth > 2;
      const hideForZoom = farTreeMode && sprite.userData.depth > 2;
      sprite.visible = !(hideForDepth || hideForZoom);
      if (!sprite.visible) return;

      const spriteDistance = camera.position.distanceTo(sprite.position);
      const localBoost = THREE.MathUtils.clamp((spriteDistance / 1300) * 0.95, 0.85, 2.45);
      const boost = Math.max(localBoost, zoomBoost * 0.84);
      sprite.scale.set(base.x * boost, base.y * boost, 1);
      sprite.material.opacity = farTreeMode ? 0.9 : 1;
    });

    controls.update();
    renderer.render(scene, camera);
  };
  animate();

  return () => {
    window.cancelAnimationFrame(animationFrameId);
    resizeObserver.disconnect();
    renderer.domElement.removeEventListener('pointermove', handlePointerMove);
    renderer.domElement.removeEventListener('click', handleClick);
    if (typeof onFocusPersonReady === 'function') {
      onFocusPersonReady(null);
    }
    if (typeof onStructureReady === 'function') {
      onStructureReady([]);
    }
    controls.dispose();
    disposeSceneGraph(sceneGroup);
    renderer.dispose();
    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
  };
}

export default function FamilyTree({ people, onSelect, language, backgroundColor = '#fdfbf7', nodeShape = 'circle', treeOrientation = 'vertical', treeRenderMode = '2d', threeLabelDensity = 'all', birthdayPersonIds = new Set() }) {
  const containerRef = useRef();
  const focusPersonRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [structureItems, setStructureItems] = useState([]);
  const [activeStructureId, setActiveStructureId] = useState(null);
  const [isStructurePanelOpen, setIsStructurePanelOpen] = useState(true);
  const isRtlLanguage = language === 'ar';
  const horizontalFlowDirection = isRtlLanguage ? -1 : 1;

  const structurePanelTitle = language === 'ar'
    ? 'هيكل الشجرة'
    : (language === 'fr' ? 'Structure de l\'arbre' : 'Tree Structure');
  const structureHideLabel = language === 'ar'
    ? 'اخفاء'
    : (language === 'fr' ? 'Masquer' : 'Hide');
  const structureShowLabel = language === 'ar'
    ? 'اظهار الهيكل'
    : (language === 'fr' ? 'Afficher la structure' : 'Show Structure');

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setContainerSize({ width, height });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    if (!people || people.length === 0) return;

    if (treeRenderMode === '3d') {
      return renderThreeTree({
        container,
        people,
        onSelect,
        backgroundColor,
        treeOrientation,
        horizontalFlowDirection,
        nodeShape,
        birthdayPersonIds,
        containerSize,
        labelDensityMode: threeLabelDensity,
        onStructureReady: (items) => setStructureItems(items),
        onFocusPersonReady: (handler) => {
          focusPersonRef.current = typeof handler === 'function' ? handler : null;
        },
      });
    }

    const data = buildTreeData(people);
    
    const nodeWidth = 320; 
    const nodeHeight = 320; // Increased height to accommodate dates
    const width = containerSize.width || container.clientWidth || 1000;
    const height = containerSize.height || container.clientHeight || 700;
    const cardWidth = 258;
    const cardHeight = 78;
    const avatarRadius = 22;

    const svg = d3.select(container)
      .append("svg")
      .attr("width", "100%")
      .attr("height", height)
      .style("background-color", "transparent")
      .style("cursor", "grab");

    const defs = svg.append("defs");

    const shadow = defs.append("filter").attr("id", "shadow").attr("height", "130%");
    shadow.append("feGaussianBlur").attr("in", "SourceAlpha").attr("stdDeviation", 3);
    shadow.append("feOffset").attr("dx", 2).attr("dy", 2).attr("result", "offsetblur");
    shadow.append("feComponentTransfer").append("feFuncA").attr("type", "linear").attr("slope", 0.2);
    const merge = shadow.append("feMerge");
    merge.append("feMergeNode");
    merge.append("feMergeNode").attr("in", "SourceGraphic");

    const cardShadow = defs.append("filter")
      .attr("id", "card-shadow")
      .attr("x", "-20%")
      .attr("y", "-20%")
      .attr("width", "140%")
      .attr("height", "140%");
    cardShadow.append("feDropShadow")
      .attr("dx", 0)
      .attr("dy", 3)
      .attr("stdDeviation", 3)
      .attr("flood-color", "rgba(15,23,42,0.18)");

    const g = svg.append("g");

    const zoom = d3.zoom()
      .scaleExtent([0.2, 2])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);

    const treeLayout = d3.tree().nodeSize([nodeWidth, nodeHeight]);
    const rootD3 = d3.hierarchy(data, d => d.children);
    treeLayout(rootD3);

    const structureSeen = new Set();
    const structureEntries = [];
    const focusTargets = new Map();

    rootD3.descendants().forEach((node) => {
      if (node.depth === 0) return;
      (node.data.parents || []).forEach((person) => {
        const id = String(person.id);
        if (structureSeen.has(id)) return;
        structureSeen.add(id);
        const label = `${person.first_name || ''} ${person.last_name || ''}`.trim() || 'Unnamed';
        structureEntries.push({ id, label, depth: node.depth, photoUrl: person.photo_url || '' });
      });
    });

    setStructureItems(structureEntries);
    focusPersonRef.current = (personId) => {
      const target = focusTargets.get(String(personId));
      if (!target) return;
      const scale = 1.08;
      const tx = (width * 0.5) - (target.x * scale);
      const ty = (height * 0.34) - (target.y * scale);
      svg.transition().duration(420).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    };

    const getNodePosition = (node) => {
      if (treeOrientation === 'horizontal') {
        return { x: node.y * horizontalFlowDirection, y: node.x };
      }
      return { x: node.x, y: node.y };
    };

    const nodeMap = {};
    rootD3.descendants().forEach(d => { nodeMap[d.data.id] = d; });

    const extraLinkData = (data.extraLinks || [])
      .map(link => ({ source: nodeMap[link.sourceFam], target: nodeMap[link.targetFam] }))
      .filter(l => l.source && l.target); 

    g.selectAll(".link")
      .data(rootD3.links().filter(l => l.source.depth > 0)) 
      .enter()
      .insert("path", "g")
      .attr("fill", "none")
      .attr("stroke", "#d1c4ae")
      .attr("stroke-width", 2)
      .attr("d", d => {
        const source = getNodePosition(d.source);
        const target = getNodePosition(d.target);
        if (treeOrientation === 'horizontal') {
          const tX = target.x - (80 * horizontalFlowDirection);
          const cX = (source.x + tX) / 2;
          return `M${source.x},${source.y} C${cX},${source.y} ${cX},${target.y} ${tX},${target.y}`;
        }
        const tY = target.y - 50;
        return `M${source.x},${source.y} C${source.x},${(source.y + tY) / 2} ${target.x},${(source.y + tY) / 2} ${target.x},${tY}`;
      });

    g.selectAll(".extra-link")
      .data(extraLinkData)
      .enter()
      .insert("path", "g")
      .attr("fill", "none")
      .attr("stroke", "#d1c4ae")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "5,5") 
      .attr("d", d => {
        const source = getNodePosition(d.source);
        const target = getNodePosition(d.target);
        if (treeOrientation === 'horizontal') {
          const tX = target.x - (80 * horizontalFlowDirection);
          const cX = (source.x + tX) / 2;
          return `M${source.x},${source.y} C${cX},${source.y} ${cX},${target.y} ${tX},${target.y}`;
        }
        const tY = target.y - 50;
        return `M${source.x},${source.y} C${source.x},${(source.y + tY) / 2} ${target.x},${(source.y + tY) / 2} ${target.x},${tY}`;
      });

    const nodes = g.selectAll(".node")
      .data(rootD3.descendants().filter(d => d.depth > 0))
      .enter()
      .append("g")
      .attr("transform", d => {
        const pos = getNodePosition(d);
        return `translate(${pos.x},${pos.y})`;
      });

    nodes.each(function(d) {
      const group = d3.select(this);
      const parents = d.data.parents;
      const isHorizontalLayout = treeOrientation === 'horizontal';
      const spacing = isHorizontalLayout ? 170 : 290;
      const startOffset = -((parents.length - 1) * spacing) / 2;
      const nodePosition = getNodePosition(d);

      const parentSlots = parents.map((_, i) => {
        const localX = isHorizontalLayout ? 0 : startOffset + (i * spacing);
        const localY = isHorizontalLayout ? startOffset + (i * spacing) : 0;
        return { localX, localY };
      });

      if (parentSlots.length > 1) {
        const first = parentSlots[0];
        const last = parentSlots[parentSlots.length - 1];
        group.append('line')
          .attr('x1', first.localX)
          .attr('y1', first.localY)
          .attr('x2', last.localX)
          .attr('y2', last.localY)
          .attr('stroke', '#d97c7c')
          .attr('stroke-width', 2)
          .attr('stroke-linecap', 'round')
          .attr('opacity', 0.92);
      }

      parents.forEach((person, i) => {
        const slot = parentSlots[i];
        const localX = slot.localX;
        const localY = slot.localY;
        const pGroup = group.append("g")
          .attr("transform", `translate(${localX}, ${localY})`)
          .style("cursor", "pointer")
          .on("click", (e) => { e.stopPropagation(); onSelect(person); });

        const personId = String(person.id);
        focusTargets.set(personId, { x: nodePosition.x + localX, y: nodePosition.y + localY });

        const isDeceased = !!person.death_date;
        const isBirthdayToday = birthdayPersonIds.has(String(person.id));
        const cardFill = isDeceased ? '#ebedf0' : (person.gender === 'M' ? '#d7ebf8' : '#f4efdf');
        const cardStroke = isDeceased ? '#2f3135' : (person.gender === 'M' ? '#7faec7' : '#d4c5aa');

        pGroup.append("rect")
          .attr("x", -cardWidth / 2)
          .attr("y", -cardHeight / 2)
          .attr("width", cardWidth)
          .attr("height", cardHeight)
          .attr("rx", 14)
          .attr("ry", 14)
          .attr("fill", cardFill)
          .attr("stroke", cardStroke)
          .attr("stroke-width", isDeceased ? 2.6 : 1.8)
          .style("filter", "url(#card-shadow)");

        if (isBirthdayToday) {
          pGroup.append('circle')
            .attr('cx', (cardWidth / 2) - 16)
            .attr('cy', (-cardHeight / 2) + 16)
            .attr('r', 8)
            .attr('fill', '#f59e0b')
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 2);
        }
        
        const photoCenterX = -cardWidth / 2 + 34;
        const photoCenterY = 0;

        if (person.photo_url) {
          const pId = `pattern-${person.id}`;
          if (defs.select(`#${pId}`).empty()) {
            defs.append("pattern")
              .attr("id", pId)
              .attr("width", 1)
              .attr("height", 1)
              .attr("patternUnits", "objectBoundingBox") 
              .append("image")
              .attr("href", person.photo_url)
              .attr("width", avatarRadius * 2)
              .attr("height", avatarRadius * 2)
              .attr("x", 0).attr("y", 0)
              .attr("preserveAspectRatio", "xMidYMid slice"); 
          }

          pGroup.append('circle')
            .attr('cx', photoCenterX)
            .attr('cy', photoCenterY)
            .attr('r', avatarRadius)
            .attr('fill', `url(#${pId})`)
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 2.5)
            .style('filter', 'url(#shadow)');
        } else {
          pGroup.append('circle')
            .attr('cx', photoCenterX)
            .attr('cy', photoCenterY)
            .attr('r', avatarRadius)
            .attr('fill', isDeceased ? '#d4d7dc' : '#cdd7e2')
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 2.5)
            .style('filter', 'url(#shadow)');
        }

        if (isDeceased) {
          pGroup.append("text")
            .attr("dx", (cardWidth / 2) - 12)
            .attr("dy", (-cardHeight / 2) + 18)
            .attr("text-anchor", "middle")
            .style("font-size", "18px") 
            .text("💀"); 
        }
        
        const fullName = `${person.first_name || ''} ${person.last_name || ''}`.trim() || 'Unnamed';
        const textStartX = -cardWidth / 2 + 66;
        pGroup.append("text")
          .attr("x", textStartX)
          .attr("y", -2)
          .attr("text-anchor", "start")
          .style("font-size", "15px")
          .style("font-weight", "700")
          .style("fill", isDeceased ? "#3f3f46" : "#111827")
          .text(fullName);
          
        if (person.birth_date) {
            const birthYear = new Date(person.birth_date).getFullYear();
            const deathYear = isDeceased ? new Date(person.death_date).getFullYear() : '';
            const lifespan = isDeceased ? `${birthYear} - ${deathYear}` : `* ${birthYear}`;
            
            pGroup.append("text")
              .attr("x", textStartX)
              .attr("y", 20)
              .attr("text-anchor", "start")
              .style("font-size", "12px")
              .style("fill", "#374151")
              .text(lifespan);
        }
      });
    });

    if (treeOrientation === 'horizontal') {
      const horizontalStartX = horizontalFlowDirection === 1 ? 80 : width - 80;
      svg.call(zoom.transform, d3.zoomIdentity.translate(horizontalStartX, height / 2).scale(0.8));
    } else {
      svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, 80).scale(0.8));
    }

    return () => {
      focusPersonRef.current = null;
      d3.select(container).selectAll('svg').remove();
    };
  }, [people, onSelect, backgroundColor, nodeShape, treeOrientation, treeRenderMode, threeLabelDensity, treeRenderMode === '2d' ? containerSize : null, birthdayPersonIds, horizontalFlowDirection]);

  return (
    <div
      className="tree-layout-shell"
      style={{
        width: '100%',
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: structureItems.length > 0 && isStructurePanelOpen
          ? (isRtlLanguage ? 'minmax(0, 1fr) minmax(220px, 300px)' : 'minmax(220px, 300px) minmax(0, 1fr)')
          : 'minmax(0, 1fr)',
        gap: '12px',
        alignItems: 'stretch',
      }}
    >
      {structureItems.length > 0 && isStructurePanelOpen && (
        <aside className="structure-panel" style={{ order: isRtlLanguage ? 2 : 1 }}>
          <div className="structure-panel-header">
            <div className="structure-panel-title">
              {structurePanelTitle}
            </div>
            <button
              type="button"
              className="advanced-card-toggle structure-panel-dismiss-btn"
              onClick={() => setIsStructurePanelOpen(false)}
              title={structureHideLabel}
              aria-label={structureHideLabel}
            >
              <span className="advanced-card-toggle-icon">▾</span>
            </button>
          </div>

          <div className="structure-panel-list">
            {structureItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  focusPersonRef.current?.(item.id);
                  setActiveStructureId(item.id);
                }}
                className={`shape-btn structure-panel-item ${activeStructureId === item.id ? 'active' : ''} ${item.depth > 1 ? 'has-depth' : ''}`}
                style={{
                  justifyContent: isRtlLanguage ? 'flex-end' : 'flex-start',
                  width: '100%',
                  textAlign: isRtlLanguage ? 'right' : 'left',
                  '--depth-level': Math.max(0, item.depth - 1),
                  paddingLeft: isRtlLanguage ? '12px' : `${16 + (Math.max(0, item.depth - 1) * 14)}px`,
                  paddingRight: isRtlLanguage ? `${16 + (Math.max(0, item.depth - 1) * 14)}px` : '12px',
                }}
              >
                <span className="structure-node-branch" />
                {item.photoUrl
                  ? <img src={item.photoUrl} alt="" className="structure-item-photo" />
                  : <span className="structure-item-photo structure-item-photo-fallback">•</span>}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </aside>
      )}

      {structureItems.length > 0 && !isStructurePanelOpen && (
        <div className="structure-panel-reopen-wrap" style={{ left: isRtlLanguage ? 'auto' : '8px', right: isRtlLanguage ? '8px' : 'auto' }}>
          <button
            type="button"
            className="advanced-card-toggle structure-panel-reopen-btn"
            onClick={() => setIsStructurePanelOpen(true)}
            title={structureShowLabel}
            aria-label={structureShowLabel}
          >
            <span className="advanced-card-toggle-icon is-collapsed">▾</span>
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        className="tree-container"
        style={{ width: '100%', height: 'clamp(440px, 75vh, 860px)', position: 'relative', '--tree-bg': backgroundColor, order: isRtlLanguage ? 1 : 2 }}
      />
    </div>
  );
}