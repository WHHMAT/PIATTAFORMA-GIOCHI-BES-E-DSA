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
    let score = 0;
    let placedItems = 0;
    let timerInterval = null;
    let seconds = 0;
    let studentInfo = {};

    // 0. Qui caricheremo le variabili globali passate dal template
    //    Le variabili `gameData` e `gameId` sono ora globali e disponibili
    //    grazie al template Python (`game_template.html`).
    //    Non è più necessario recuperare i dati dall'URL o da un file.

    // Funzione per la sintesi vocale (Text-to-Speech)
    function speakText(text) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'it-IT';
            window.speechSynthesis.speak(utterance);
        } else {
            alert("Il tuo browser non supporta la sintesi vocale.");
        }
    }

    // 1. Inizializza o resetta il gioco
    function initGame() {
        score = 0;
        placedItems = 0;
        scoreCountEl.textContent = score;
        feedbackArea.textContent = '';
        modalEl.style.display = 'none';

        // Usa direttamente gameData, non è più necessario caricarlo
        instructionTextEl.textContent = gameData.instruction || "Trascina ogni elemento nella sua categoria.";
        itemsContainer.innerHTML = '<h2>Elementi da classificare</h2>';
        categoriesContainer.innerHTML = '';

        createCategories();
        createItems();
        startTimer();
    }

    // 2. Crea le categorie (drop zones)
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

    // 3. Crea gli elementi da trascinare
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

    // 4. Avvia e gestisce il timer
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

    // 5. Gestisce il drop di un elemento
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

        if (placedItems === gameData.items.length) {
            showGameEnd();
        }
    }

    // 6. Mostra la schermata di fine gioco
    function showGameEnd() {
        clearInterval(timerInterval);
        feedbackArea.textContent = 'Complimenti, hai classificato tutto!';
        feedbackArea.style.color = 'blue';

        finalScoreEl.textContent = score;
        totalItemsEl.textContent = gameData.items.length;
        finalTimeEl.textContent = timerEl.textContent;

        // Richiama la nuova funzione per l'invio dei risultati
        sendResultsToServer();

        setTimeout(() => {
            modalEl.style.display = 'flex';
        }, 1000);
    }

    // 7. Invia i risultati al server
    async function sendResultsToServer() {
        // Chiedi i dati allo studente
        const studentName = prompt("Complimenti! Inserisci il tuo nome per inviare i risultati all'insegnante:");
        const studentEmail = prompt("Ora inserisci la tua email:");

        if (!studentName || !studentEmail) {
            alert("Risultati non inviati. I campi sono obbligatori.");
            return;
        }

        const payload = {
            name: studentName,
            email: studentEmail,
            score: `${score} / ${gameData.items.length}`,
            time: timerEl.textContent,
        };

        try {
            // L'ID del gioco viene preso dalla variabile globale `gameId`
            const response = await fetch(`/api/submit_result/${gameId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                 throw new Error('Errore durante l\'invio dei risultati.');
            }
            
            const result = await response.json();
            if (result.status === 'success') {
                alert("Risultati inviati con successo all'insegnante!");
            } else {
                alert(`Errore nell'invio dei risultati: ${result.message}`);
            }

        } catch (error) {
            console.error("Errore nell'invio dei risultati:", error);
            alert("Errore di rete. Impossibile inviare i risultati.");
        }
    }

    // 8. Event listeners
    playAgainBtn.addEventListener('click', initGame);
    speakBtn.addEventListener('click', () => {
        const textToSpeak = instructionTextEl.textContent;
        if (textToSpeak) speakText(textToSpeak);
    });

    // 9. Avvia il gioco
    initGame();
});