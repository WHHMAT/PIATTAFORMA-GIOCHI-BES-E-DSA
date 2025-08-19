document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTI DEL DOM ---
    const instructionTextEl = document.getElementById('instruction-text');
    const itemsContainer = document.getElementById('items-container');
    const categoriesContainer = document.getElementById('categories-container');
    const feedbackArea = document.getElementById('feedback-area');
    const scoreCountEl = document.getElementById('score-count');
    const timerEl = document.getElementById('timer');
    const modalEl = document.getElementById('end-game-modal');
    const finalScoreEl = document.getElementById('final-score');
    const totalItemsEl = document.getElementById('total-items');
    const finalTimeEl = document.getElementById('final-time');
    const playAgainBtn = document.getElementById('play-again-btn');
    const speakBtn = document.getElementById('speak-btn');

    // --- VARIABILI DI STATO ---
    let gameData = {};
    let score = 0;
    let placedItems = 0;
    let timerInterval = null;
    let seconds = 0;
    let studentInfo = {};

    // 0. Recupera i dati dello studente dall'URL
    const urlParams = new URLSearchParams(window.location.search);
    studentInfo = { name: urlParams.get('name'), email: urlParams.get('email') };

    // 1. Carica i dati del gioco dal file JSON
    async function loadGameData() {
        try {
            const response = await fetch('data.json');
            if (!response.ok) throw new Error(`Errore HTTP: ${response.status}`);
            gameData = await response.json();
            initGame();
        } catch (error) {
            console.error("Errore nel caricamento di data.json:", error);
            categoriesContainer.innerHTML = "<p>Errore: impossibile caricare i dati del gioco.</p>";
        }
    }

    // Funzione per la sintesi vocale (Text-to-Speech)
    function speakText(text) {
        if ('speechSynthesis' in window) {
            // Ferma qualsiasi discorso precedente per evitare sovrapposizioni
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'it-IT'; // Imposta la lingua italiana
            window.speechSynthesis.speak(utterance);
        } else {
            alert("Il tuo browser non supporta la sintesi vocale.");
        }
    }

    // 2. Inizializza o resetta il gioco
    function initGame() {
        score = 0;
        placedItems = 0;
        scoreCountEl.textContent = score;
        feedbackArea.textContent = '';
        modalEl.style.display = 'none';

        instructionTextEl.textContent = gameData.instruction || "Trascina ogni elemento nella sua categoria.";
        // Pulisce e ricrea il tabellone
        itemsContainer.innerHTML = '<h2>Elementi da classificare</h2>';
        categoriesContainer.innerHTML = '';

        createCategories();
        createItems();
        startTimer();
    }

    // 3. Crea le categorie (drop zones)
    function createCategories() {
        gameData.categories.forEach(cat => {
            const categoryBox = document.createElement('div');
            categoryBox.className = 'category-box';
            categoryBox.dataset.category = cat.id;
            categoryBox.innerHTML = `<h3>${cat.name}</h3>`;
            categoriesContainer.appendChild(categoryBox);

            categoryBox.addEventListener('dragover', e => {
                e.preventDefault();
                categoryBox.classList.add('drag-over');
            });
            categoryBox.addEventListener('dragleave', () => categoryBox.classList.remove('drag-over'));
            categoryBox.addEventListener('drop', handleDrop);
        });
    }

    // 4. Crea gli elementi da trascinare
    function createItems() {
        const shuffledItems = [...gameData.items].sort(() => Math.random() - 0.5);
        shuffledItems.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.id = item.id;
            itemEl.className = 'draggable-item';
            itemEl.draggable = true;
            itemEl.textContent = item.name;
            itemEl.dataset.category = item.category;
            itemsContainer.appendChild(itemEl);

            itemEl.addEventListener('dragstart', e => {
                e.dataTransfer.setData('text/plain', itemEl.id);
                setTimeout(() => itemEl.classList.add('dragging'), 0);
            });
            itemEl.addEventListener('dragend', () => itemEl.classList.remove('dragging'));
        });
    }

    // 5. Avvia e gestisce il timer
    function startTimer() {
        clearInterval(timerInterval);
        seconds = 0;
        timerEl.textContent = '00:00';
        timerInterval = setInterval(() => {
            seconds++;
            const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
            const secs = (seconds % 60).toString().padStart(2, '0');
            timerEl.textContent = `${mins}:${secs}`;
        }, 1000);
    }

    // 6. Gestisce il drop di un elemento
    function handleDrop(e) {
        e.preventDefault();
        this.classList.remove('drag-over');
        const itemId = e.dataTransfer.getData('text/plain');
        const draggedElement = document.getElementById(itemId);
        const targetCategory = this.dataset.category;

        if (draggedElement.dataset.category === targetCategory) {
            this.appendChild(draggedElement);
            draggedElement.draggable = false;
            draggedElement.style.cursor = 'default';
            
            score++;
            placedItems++;
            scoreCountEl.textContent = score;
            feedbackArea.textContent = 'Corretto!';
            feedbackArea.style.color = 'green';
        } else {
            feedbackArea.textContent = 'Sbagliato, riprova!';
            feedbackArea.style.color = 'red';
        }

        // Controlla se il gioco è finito
        if (placedItems === gameData.items.length) {
            showGameEnd();
        }
    }

    // 7. Mostra la schermata di fine gioco
    function showGameEnd() {
        clearInterval(timerInterval);
        feedbackArea.textContent = 'Complimenti, hai classificato tutto!';
        feedbackArea.style.color = 'blue';

        // Popola il modale
        finalScoreEl.textContent = score;
        totalItemsEl.textContent = gameData.items.length;
        finalTimeEl.textContent = timerEl.textContent;

        sendResultsToServer();

        // Mostra il modale con un piccolo ritardo
        setTimeout(() => {
            modalEl.style.display = 'flex';
        }, 1000);
    }

    // 8. Invia i risultati al server
    async function sendResultsToServer() {
        // Invia solo se nome e email sono presenti
        if (!studentInfo.name || !studentInfo.email) {
            console.log("Dati studente non trovati, invio email saltato.");
            return;
        }

        const pathParts = window.location.pathname.split('/');
        const projectName = pathParts[pathParts.length - 2];
        const payload = {
            ...studentInfo,
            score: `${score} / ${gameData.items.length}`,
            time: timerEl.textContent,
        };

        try {
            await fetch(`/api/submit_result/${projectName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (error) {
            console.error("Errore nell'invio dei risultati:", error);
        }
    }

    // 9. Event listeners
    playAgainBtn.addEventListener('click', initGame);
    speakBtn.addEventListener('click', () => {
        const textToSpeak = instructionTextEl.textContent;
        if (textToSpeak) speakText(textToSpeak);
    });

    // 10. Avvia il gioco
    loadGameData();
});