document.addEventListener('DOMContentLoaded', () => {
    // --- Initialisation ---
    const canvas = document.getElementById('drawing-canvas');
    const ctx = canvas.getContext('2d');

    // Références aux boutons
    const toolButtons = document.querySelectorAll('.tool-btn');
    const clearButton = document.getElementById('btn-clear');
    const saveButton = document.getElementById('btn-save');
    const loadButton = document.getElementById('btn-load');
    const fileLoader = document.getElementById('file-loader');
    const undoButton = document.getElementById('btn-undo');
    const redoButton = document.getElementById('btn-redo');
    const colorPicker = document.getElementById('color-picker');

    // --- État de l'application ---
    let shapes = []; // Notre "modèle", la liste de toutes les formes dessinées
    // Piles pour l'historique des actions
    let undoStack = [];
    let redoStack = [];
    let pointNameCounter = 0; // Pour nommer les points A, B, C...
    let currentColor = '#000000'; // Couleur de dessin actuelle

    let currentTool = null;
    let isDrawingLine = false; // Pour gérer le dessin de ligne en 2 clics
    let lineStartPoint = null;
    // --- État du compas persistant ---
    let compassState = {
        center: null, // {x, y} - La pointe
        pencil: null, // {x, y} - Le crayon
        radius: 0,
    };
    let isDraggingCompass = false;
    let compassDragMode = null; // 'moving', 'resizing', 'rotating'
    let compassDragStart = {}; // Pour stocker les offsets de glissement

    let arcState = { startAngle: 0, endAngle: 0 };
    let currentMousePos = null; // Pour le dessin en temps réel

    // --- Fonctions de dessin ---

    /**
     * Convertit un nombre en une séquence de lettres majuscules (1->A, 2->B, 27->AA).
     * @param {number} n - Le numéro du point.
     * @returns {string} Le nom du point.
     */
    function getPointName(n) {
        if (n <= 0) return '';
        // Le nombre de primes (A', A'', etc.)
        const primeCount = Math.floor((n - 1) / 26);
        // L'index de la lettre (0 pour A, 25 pour Z)
        const letterIndex = (n - 1) % 26;
        const letter = String.fromCharCode(65 + letterIndex);
        const primes = "'".repeat(primeCount);
        return letter + primes;
    }

    /**
     * Convertit un nom de point (ex: 'A', 'B', 'AA') en son numéro séquentiel.
     * @param {string} name - Le nom du point.
     * @returns {number} Le numéro du point.
     */
    function getPointNumber(name) {
        if (!name || name.length === 0) return 0;
        const letter = name.charAt(0);
        const primeCount = name.length - 1;
        const letterValue = letter.charCodeAt(0) - 65; // A=0, B=1...
        return primeCount * 26 + letterValue + 1;
    }

    /**
     * Calcule la position de la charnière du compas pour un rendu réaliste.
     */
    function calculateHinge(center, pencil) {
        if (!center || !pencil) return null;
        const radius = Math.hypot(pencil.x - center.x, pencil.y - center.y);
        if (radius < 1) return { x: center.x, y: center.y - 30 }; // Cas où le compas est fermé

        const hingeRadius = 10;
        const legHeightFactor = 0.5;

        const midPoint = { x: (center.x + pencil.x) / 2, y: (center.y + pencil.y) / 2 };
        const dx = pencil.x - center.x;
        const dy = pencil.y - center.y;
        const perpDx = -dy / radius;
        const perpDy = dx / radius;
        const height = Math.max(radius * legHeightFactor, hingeRadius * 1.5);
        return { x: midPoint.x + perpDx * height, y: midPoint.y + perpDy * height };
    }

    /**
     * Détermine sur quelle partie du compas l'utilisateur a cliqué.
     */
    function getCompassHit(pos) {
        if (!compassState.center) return null;
        const hitRadius = 25; // Rayon de détection du clic (agrandi)
        const hinge = calculateHinge(compassState.center, compassState.pencil);
        if (hinge && Math.hypot(pos.x - hinge.x, pos.y - hinge.y) < hitRadius) return 'rotating';
        if (Math.hypot(pos.x - compassState.pencil.x, pos.y - compassState.pencil.y) < hitRadius) return 'resizing';
        if (Math.hypot(pos.x - compassState.center.x, pos.y - compassState.center.y) < hitRadius) return 'moving';
        return null;
    }

    /**
     * Efface et redessine tout le canvas à partir de la liste `shapes`.
     */
    function redrawCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        shapes.forEach(shape => {
            if (shape.type === 'point') {
                drawPoint(shape);
            } else if (shape.type === 'line') {
                drawLine(shape);
            } else if (shape.type === 'arc') {
                drawArc(shape);
            }
        });

        // Dessine la ligne temporaire en cours de création
        if (isDrawingLine && lineStartPoint && currentMousePos) {
            ctx.beginPath();
            ctx.moveTo(lineStartPoint.x, lineStartPoint.y);
            ctx.lineTo(currentMousePos.x, currentMousePos.y);
            // Utilise la couleur actuelle avec de la transparence
            ctx.strokeStyle = currentColor + '80'; // Ajoute 50% d'opacité (hex 80)
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]); // Ligne en pointillés
            ctx.stroke();
            ctx.setLineDash([]); // Réinitialise pour les prochains traits
        }

        // Dessine le compas s'il existe, et l'arc temporaire en cours de tracé
        if (compassState.center) {
            drawCompass();

            if (isDraggingCompass && compassDragMode === 'rotating') {
                ctx.beginPath();
                ctx.arc(compassState.center.x, compassState.center.y, compassState.radius, arcState.startAngle, arcState.endAngle);
                ctx.strokeStyle = '#808080' + '80'; // Gris semi-transparent pour le tracé
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
    }

    /**
     * Redimensionne le canvas pour remplir l'espace et redessine le contenu.
     */
    function resizeCanvas() {
        // Sauvegarde le contenu actuel pour le redessiner
        const shapesToRedraw = JSON.parse(JSON.stringify(shapes));
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        shapes = shapesToRedraw;
        redrawCanvas();
    }

    function drawArc(arc) {
        ctx.beginPath();
        ctx.arc(arc.cx, arc.cy, arc.radius, arc.startAngle, arc.endAngle);
        ctx.strokeStyle = arc.color || '#0000FF';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    function drawCompass() {
        const center = compassState.center;
        const pencil = compassState.pencil;
        const radius = compassState.radius;

        const hinge = calculateHinge(center, pencil);
        if (!hinge) return;

        // --- 1. Calculer la géométrie ---
        const legWidthAtHinge = 8;
        const legWidthAtTip = 4;
        const hingeRadius = 10;

        // --- 2. Dessiner les branches ---
        const drawLeg = (tipPoint, isMetal) => {
             const legDx = tipPoint.x - hinge.x;
             const legDy = tipPoint.y - hinge.y;
             const legLength = Math.hypot(legDx, legDy);
             if (legLength < 1) return;
 
             ctx.fillStyle = isMetal ? '#C0C0C0' : '#DEB887'; // Argenté pour le métal, bois pour le crayon
             ctx.strokeStyle = '#696969'; // Gris foncé
             ctx.lineWidth = 1;

             const legPerpDx = -legDy / legLength;
             const legPerpDy = legDx / legLength;
 
             ctx.beginPath();
             ctx.moveTo(hinge.x - legPerpDx * legWidthAtHinge / 2, hinge.y - legPerpDy * legWidthAtHinge / 2);
             ctx.lineTo(hinge.x + legPerpDx * legWidthAtHinge / 2, hinge.y + legPerpDy * legWidthAtHinge / 2);
             ctx.lineTo(tipPoint.x + legPerpDx * legWidthAtTip / 2, tipPoint.y + legPerpDy * legWidthAtTip / 2);
             ctx.lineTo(tipPoint.x - legPerpDx * legWidthAtTip / 2, tipPoint.y - legPerpDy * legWidthAtTip / 2);
             ctx.closePath();
             ctx.fill();
             ctx.stroke();
        };

        drawLeg(center, true); // La branche de la pointe est en métal
        drawLeg(pencil, false); // La branche du crayon est en bois

        // --- 3. Dessiner la charnière ---
        ctx.fillStyle = '#A9A9A9';
        ctx.beginPath();
        ctx.arc(hinge.x, hinge.y, hingeRadius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#696969';
        ctx.beginPath();
        ctx.arc(hinge.x, hinge.y, hingeRadius * 0.4, 0, 2 * Math.PI);
        ctx.fill();

        // --- 4. Dessiner la pointe ---
        const spikeSize = 10;
        const spikeWidth = 6;
        const spikeLegDx = center.x - hinge.x;
        const spikeLegDy = center.y - hinge.y;
        const spikeLegLength = Math.hypot(spikeLegDx, spikeLegDy);
        if (spikeLegLength > 0) {
            const spikeDirX = spikeLegDx / spikeLegLength; // Vecteur de la charnière vers le centre
            const spikeDirY = spikeLegDy / spikeLegLength;
            const spikePerpX = -spikeDirY;
            const spikePerpY = spikeDirX;

            // La base du cône de la pointe, "au-dessus" de la pointe
            const spikeBase = { x: center.x - spikeDirX * spikeSize, y: center.y - spikeDirY * spikeSize };

            ctx.fillStyle = '#FFFFFF'; // Pointe blanche
            ctx.strokeStyle = '#404040'; // Contour sombre pour la visibilité
            ctx.beginPath();
            ctx.moveTo(center.x, center.y); // La pointe est exactement au centre
            ctx.lineTo(spikeBase.x + spikePerpX * spikeWidth / 2, spikeBase.y + spikePerpY * spikeWidth / 2);
            ctx.lineTo(spikeBase.x - spikePerpX * spikeWidth / 2, spikeBase.y - spikePerpY * spikeWidth / 2);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }

        // --- 5. Dessiner le crayon ---
        const pencilHolderHeight = 12;
        const pencilHolderWidth = 9;
        const pencilTipHeight = 8;

        const pencilLegDx = pencil.x - hinge.x;
        const pencilLegDy = pencil.y - hinge.y;
        const pencilLegLength = Math.hypot(pencilLegDx, pencilLegDy);
        if (pencilLegLength > 0) {
            const pencilDirX = pencilLegDx / pencilLegLength;
            const pencilDirY = pencilLegDy / pencilLegLength;
            const pencilTipBase = { x: pencil.x - pencilDirX * pencilTipHeight, y: pencil.y - pencilDirY * pencilTipHeight };
            const pencilHolderBase = { x: pencil.x - pencilDirX * (pencilTipHeight + pencilHolderHeight), y: pencil.y - pencilDirY * (pencilTipHeight + pencilHolderHeight) };
            const pencilPerpX = -pencilDirY;
            const pencilPerpY = pencilDirX;

            // Dessine le support en bois du crayon
            ctx.fillStyle = '#DEB887'; // Couleur bois
            ctx.beginPath();
            ctx.moveTo(pencilHolderBase.x + pencilPerpX * pencilHolderWidth / 2, pencilHolderBase.y + pencilPerpY * pencilHolderWidth / 2);
            ctx.lineTo(pencilHolderBase.x - pencilPerpX * pencilHolderWidth / 2, pencilHolderBase.y - pencilPerpY * pencilHolderWidth / 2);
            ctx.lineTo(pencilTipBase.x - pencilPerpX * pencilHolderWidth / 2, pencilTipBase.y - pencilPerpY * pencilHolderWidth / 2);
            ctx.lineTo(pencilTipBase.x + pencilPerpX * pencilHolderWidth / 2, pencilTipBase.y + pencilPerpY * pencilHolderWidth / 2);
            ctx.closePath();
            ctx.fill();

            // Dessine la mine en graphite
            ctx.fillStyle = (isDraggingCompass && compassDragMode === 'rotating') ? '#808080' : '#202020'; // Gris pour dessiner
            ctx.beginPath();
            ctx.moveTo(pencil.x, pencil.y); // La pointe du crayon
            ctx.lineTo(pencilTipBase.x + pencilPerpX * pencilHolderWidth / 2, pencilTipBase.y + pencilPerpY * pencilHolderWidth / 2);
            ctx.lineTo(pencilTipBase.x - pencilPerpX * pencilHolderWidth / 2, pencilTipBase.y - pencilPerpY * pencilHolderWidth / 2);
            ctx.closePath();
            ctx.fill();
        }
    }

    function drawPoint(point) {
        const crossSize = 6; // Taille des branches de la croix

        // Dessine la croix (diagonale)
        ctx.beginPath();
        ctx.moveTo(point.x - crossSize, point.y - crossSize);
        ctx.lineTo(point.x + crossSize, point.y + crossSize);
        ctx.moveTo(point.x + crossSize, point.y - crossSize);
        ctx.lineTo(point.x - crossSize, point.y + crossSize);
        ctx.strokeStyle = point.color || '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Dessine le nom du point
        ctx.fillStyle = point.color || '#000000';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        // Affiche le nom à côté de la croix
        ctx.fillText(point.name, point.x + crossSize + 3, point.y - crossSize);
    }

    function drawLine(line) {
        ctx.beginPath();
        ctx.moveTo(line.x1, line.y1);
        ctx.lineTo(line.x2, line.y2);
        ctx.strokeStyle = line.color || '#0000FF';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // --- Gestion de l'historique (Undo/Redo) ---

    /**
     * Met à jour l'état (activé/désactivé) des boutons d'historique.
     */
    function updateHistoryButtons() {
        undoButton.disabled = undoStack.length === 0;
        redoButton.disabled = redoStack.length === 0;
    }

    /**
     * Sauvegarde l'état actuel du canvas dans la pile d'annulation.
     * Doit être appelée AVANT chaque modification.
     */
    function saveState() {
        // On fait une copie complète pour ne pas sauvegarder une simple référence
        undoStack.push(JSON.parse(JSON.stringify(shapes)));
        // Dès qu'une nouvelle action est faite, l'historique "redo" n'est plus valide
        redoStack = [];
        updateHistoryButtons();
    }

    function undo() {
        if (undoStack.length > 0) {
            redoStack.push(JSON.parse(JSON.stringify(shapes)));
            shapes = undoStack.pop();
            redrawCanvas();
            updateHistoryButtons();
        }
    }

    function redo() {
        if (redoStack.length > 0) {
            undoStack.push(JSON.parse(JSON.stringify(shapes)));
            shapes = redoStack.pop();
            redrawCanvas();
            updateHistoryButtons();
        }
    }

    // --- Logique des outils ---

    /**
     * Définit l'outil actif et met à jour l'apparence des boutons.
     * @param {string} toolName - Le nom de l'outil ('point', 'line').
     */
    function setActiveTool(toolName) {
        currentTool = toolName;
        // Réinitialise les dessins en cours si on change d'outil
        isDrawingLine = false; // Réinitialise le dessin de ligne si on change d'outil
        lineStartPoint = null;
        // Arrête toute manipulation de compas si on change d'outil
        isDraggingCompass = false;
        compassDragMode = null;
        currentMousePos = null;

        toolButtons.forEach(button => {
            if (button.id === `tool-${toolName}`) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
        console.log(`Outil actif : ${currentTool}`);
        redrawCanvas(); // Force le rafraîchissement pour effacer les dessins temporaires
    }

    // Ajoute les écouteurs d'événements aux boutons d'outils
    toolButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Extrait le nom de l'outil depuis l'ID du bouton (ex: "tool-point" -> "point")
            const toolName = button.id.split('-')[1];
            setActiveTool(toolName);
        });
    });

    // --- Gestion des événements du Canvas ---

    canvas.addEventListener('mousemove', (event) => {
        currentMousePos = { x: event.offsetX, y: event.offsetY };

        if (isDraggingCompass) {
            switch (compassDragMode) {
                case 'moving':
                    const newCenterX = currentMousePos.x - compassDragStart.dx;
                    const newCenterY = currentMousePos.y - compassDragStart.dy;
                    const moveDx = newCenterX - compassState.center.x;
                    const moveDy = newCenterY - compassState.center.y;
                    compassState.center.x = newCenterX;
                    compassState.center.y = newCenterY;
                    compassState.pencil.x += moveDx;
                    compassState.pencil.y += moveDy;
                    break;
                case 'resizing':
                    compassState.pencil = { ...currentMousePos };
                    break;
                case 'rotating':
                    const dx = currentMousePos.x - compassState.center.x;
                    const dy = currentMousePos.y - compassState.center.y;
                    const angle = Math.atan2(dy, dx);
                    compassState.pencil.x = compassState.center.x + compassState.radius * Math.cos(angle);
                    compassState.pencil.y = compassState.center.y + compassState.radius * Math.sin(angle);
                    arcState.endAngle = angle;
                    break;
            }
            // Mettre à jour le rayon après un déplacement ou un redimensionnement
            if (compassDragMode === 'moving' || compassDragMode === 'resizing') {
                const rdx = compassState.pencil.x - compassState.center.x;
                const rdy = compassState.pencil.y - compassState.center.y;
                compassState.radius = Math.hypot(rdx, rdy);
            }
            redrawCanvas();
        } else if (isDrawingLine) {
            redrawCanvas();
        }
    });

    canvas.addEventListener('mousedown', (event) => {
        const x = event.offsetX;
        const y = event.offsetY;
        const mousePos = { x, y };

        if (currentTool === 'compass') {
            if (compassState.center) { // Si le compas est déjà sur le canvas
                const hit = getCompassHit(mousePos);
                if (hit) {
                    isDraggingCompass = true;
                    compassDragMode = hit;
                    if (hit === 'moving') {
                        compassDragStart.dx = x - compassState.center.x;
                        compassDragStart.dy = y - compassState.center.y;
                    } else if (hit === 'rotating') {
                        const dx = compassState.pencil.x - compassState.center.x;
                        const dy = compassState.pencil.y - compassState.center.y;
                        arcState.startAngle = Math.atan2(dy, dx);
                        arcState.endAngle = arcState.startAngle;
                    }
                }
            } else { // Premier clic pour placer le compas
                isDraggingCompass = true;
                compassDragMode = 'resizing'; // On commence par régler l'écartement
                compassState.center = { ...mousePos };
                compassState.pencil = { ...mousePos };
                compassState.radius = 0;
            }
        } else if (currentTool === 'point') {
            saveState(); // Sauvegarde l'état AVANT d'ajouter la forme
            pointNameCounter++; // Incrémente le compteur de points
            const name = getPointName(pointNameCounter);
            shapes.push({ type: 'point', x, y, name, color: currentColor }); // Ajoute le nom et la couleur
            redrawCanvas();
        } else if (currentTool === 'line') {
            if (!isDrawingLine) {
                // Premier clic : on commence la ligne
                isDrawingLine = true;
                lineStartPoint = { x, y };
                // Pas de sauvegarde ici, l'action n'est pas terminée
            } else {
                // Deuxième clic : on termine la ligne
                saveState(); // Sauvegarde l'état AVANT d'ajouter la forme
                shapes.push({ type: 'line', x1: lineStartPoint.x, y1: lineStartPoint.y, x2: x, y2: y, color: currentColor });
                isDrawingLine = false;
                lineStartPoint = null;
                currentMousePos = null; // Nettoie la position de la souris
                redrawCanvas();
            }
        }
    });

    canvas.addEventListener('mouseup', (event) => {
        if (isDraggingCompass) {
            if (compassDragMode === 'rotating') {
                // Finalise et sauvegarde l'arc tracé
            if (Math.abs(arcState.endAngle - arcState.startAngle) > 0.01) {
                saveState();
                shapes.push({ type: 'arc', cx: compassState.center.x, cy: compassState.center.y, radius: compassState.radius, startAngle: arcState.startAngle, endAngle: arcState.endAngle, color: '#808080' }); // Sauvegarde en gris
            }
            }
            isDraggingCompass = false;
            compassDragMode = null;
            redrawCanvas();
        }
    });

    // --- Logique de Sauvegarde / Chargement / Effacement ---

    clearButton.addEventListener('click', () => {
        if (confirm("Voulez-vous vraiment tout effacer ?")) {
            // Ne sauvegarde que s'il y a quelque chose à effacer
            if (shapes.length > 0) {
                saveState();
            }
            shapes = [];
            pointNameCounter = 0; // Réinitialise le compteur de noms
            isDrawingLine = false;
            compassState = { center: null, radius: 0, pencil: null }; // Efface aussi le compas
            redrawCanvas(); // redrawCanvas est appelé dans saveState via undo/redo
        }
    });

    saveButton.addEventListener('click', () => {
        // Convertit notre liste d'objets en une chaîne de caractères JSON
        const data = JSON.stringify(shapes, null, 2);
        // Crée un objet "Blob" qui représente les données
        const blob = new Blob([data], { type: 'application/json' });
        // Crée une URL temporaire pour le Blob
        const url = URL.createObjectURL(blob);

        // Crée un lien de téléchargement invisible et le clique
        const a = document.createElement('a');
        a.href = url;
        a.download = 'session_geometrie.json';
        a.click();

        // Libère l'URL temporaire
        URL.revokeObjectURL(url);
    });

    loadButton.addEventListener('click', () => {
        // Déclenche le clic sur l'input de fichier caché
        fileLoader.click();
    });

    fileLoader.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const loadedShapes = JSON.parse(e.target.result);
                // Valider que les données sont bien un tableau
                if (Array.isArray(loadedShapes)) {
                    saveState(); // Sauvegarde l'état actuel avant de charger
                    shapes = loadedShapes;

                    // Met à jour le compteur de noms pour éviter les doublons
                    const pointNames = shapes.filter(s => s.type === 'point' && s.name).map(p => p.name);
                    if (pointNames.length > 0) {
                        const maxPointNumber = Math.max(...pointNames.map(getPointNumber));
                        pointNameCounter = maxPointNumber;
                    } else {
                        pointNameCounter = 0;
                    }

                    redrawCanvas();
                } else {
                    alert("Le fichier n'est pas valide.");
                }
            } catch (error) {
                alert("Erreur lors de la lecture du fichier. Assurez-vous que c'est un fichier JSON valide.");
                console.error(error);
            }
        };
        reader.readAsText(file);
        
        // Réinitialise l'input pour pouvoir recharger le même fichier
        event.target.value = '';
    });

    // --- Écouteurs d'événements pour l'historique ---

    undoButton.addEventListener('click', undo);
    redoButton.addEventListener('click', redo);

    colorPicker.addEventListener('input', (e) => {
        currentColor = e.target.value;
    });

    // Bonus : Raccourcis clavier
    document.addEventListener('keydown', (e) => {
        // Utilise ctrlKey sur Windows/Linux et metaKey (Cmd) sur Mac
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z') {
                e.preventDefault(); // Empêche l'action par défaut du navigateur
                undo();
            } else if (e.key === 'y') {
                e.preventDefault(); // Empêche l'action par défaut du navigateur
                redo();
            }
        }
    });

    // --- Initialisation de la page ---

    // État initial des boutons au chargement de la page
    updateHistoryButtons();
    // Redimensionne le canvas une première fois
    resizeCanvas();
    // Ajoute un écouteur pour redimensionner quand la fenêtre change de taille
    window.addEventListener('resize', resizeCanvas);
});
