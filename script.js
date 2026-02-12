import * as compass from './tool-compass.js';
import * as ruler from './tool-ruler.js';

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

    // --- État de la règle persistante ---
    let rulerState = {
        visible: false,
        x: 150, // top-left corner x
        y: 150, // top-left corner y
        width: 400,
        height: 50,
        angle: 0, // in radians
    };
    let isDraggingRuler = false;
    let rulerDragMode = null; // 'moving', 'rotating'
    let rulerDragStart = {};

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
            compass.drawCompass(ctx, compassState, isDraggingCompass, compassDragMode);

            if (isDraggingCompass && compassDragMode === 'rotating') {
                ctx.beginPath();
                ctx.arc(compassState.center.x, compassState.center.y, compassState.radius, arcState.startAngle, arcState.endAngle);
                ctx.strokeStyle = '#808080' + '80'; // Gris semi-transparent pour le tracé
                ctx.lineWidth = 2;
                ctx.stroke();
            }

        }

        // Dessine la règle si elle est visible, indépendamment du compas
        ruler.drawRuler(ctx, rulerState);
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
        // Arrête toute manipulation de règle
        isDraggingRuler = false;
        rulerDragMode = null;

        // Gère la visibilité de la règle
        rulerState.visible = (toolName === 'ruler');

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
            compass.handleMouseMove(currentMousePos, compassState, compassDragMode, compassDragStart, arcState);
            redrawCanvas();
        } else if (isDraggingRuler) {
            ruler.handleMouseMove(currentMousePos, rulerState, rulerDragMode, rulerDragStart);
            redrawCanvas();
        } else if (isDrawingLine) {
            redrawCanvas();
        }
    });

    canvas.addEventListener('mousedown', (event) => {
        const x = event.offsetX;
        const y = event.offsetY;
        const mousePos = { x, y };

        if (currentTool === 'ruler') {
            const result = ruler.handleMouseDown(mousePos, rulerState, rulerDragStart);
            isDraggingRuler = result.isDragging;
            rulerDragMode = result.dragMode;
        } else if (currentTool === 'compass') {
            const result = compass.handleMouseDown(mousePos, compassState, compassDragStart, arcState);
            isDraggingCompass = result.isDragging;
            compassDragMode = result.dragMode;
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
            compass.handleMouseUp(compassDragMode, arcState, compassState, shapes, saveState);
            isDraggingCompass = false;
            compassDragMode = null;
            redrawCanvas();
        }
        if (isDraggingRuler) {
            isDraggingRuler = false;
            rulerDragMode = null;
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
            rulerState.visible = false; // Cache la règle
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
