document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTI DEL DOM ---
    const instructionTextEl = document.getElementById('instruction-text');
    const gridEl = document.getElementById('memory-grid');
    const movesCountEl = document.getElementById('moves-count');
    const timerEl = document.getElementById('timer');
    const modalEl = document.getElementById('end-game-modal');
    const finalMovesEl = document.getElementById('final-moves');
    const finalTimeEl = document.getElementById('final-time');
    const playAgainBtn = document.getElementById('play-again-btn');
    const speakBtn = document.getElementById('speak-btn'); // Pulsante TTS
    // Elementi del form nel modale
    const resultForm = document.getElementById('result-form');
    const studentNameInput = document.getElementById('student-name');
    const studentEmailInput = document.getElementById('student-email');
    const formFeedback = document.getElementById('form-feedback');

    // --- VARIABILI DI STATO ---
    let moves = 0;
    let timerInterval = null;
    let seconds = 0;
    let flippedCards = [];
    let matchedPairs = 0;
    let totalPairs = 0;
    let isChecking = false; // Per prevenire click durante il controllo

    // 0. Le variabili `gameData` e `gameId` sono ora globali e disponibili
    //    Rimuovi il recupero dei dati dello studente dall'URL.
    //    La richiesta delle informazioni avverrà alla fine del gioco.
    //    const urlParams = new URLSearchParams(window.location.search);
    //    studentInfo = { name: urlParams.get('name'), email: urlParams.get('email') };

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

    // 1. Rimuovi la funzione loadGameData().
    //    Il gioco userà direttamente la variabile `gameData` passata dal server.
    //    async function loadGameData() { ... }

    // 2. Inizializza o resetta il gioco
    function initGame() {
        moves = 0;
        seconds = 0;
        matchedPairs = 0;
        // Usa `gameData.images.length` se il tuo `data.json` ha questa struttura.
        // Altrimenti, usa semplicemente `gameData.length`
        totalPairs = gameData.images.length; // Assumiamo che il tuo data.json abbia una chiave "images"
        movesCountEl.textContent = moves;
        modalEl.style.display = 'none';
        gridEl.innerHTML = '';
        
        createBoard();
        startTimer();
    }

    // 3. Crea il tabellone di gioco
    function createBoard() {
        // Algoritmo di shuffle Fisher-Yates (più corretto)
        function shuffle(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        }

        // Usa `gameData.images` se il tuo `data.json` ha questa struttura
        let cardValues = [...gameData.images, ...gameData.images]; // Duplica le carte
        cardValues = shuffle(cardValues); // Mescola con l'algoritmo corretto

        gridEl.style.gridTemplateColumns = `repeat(${Math.ceil(Math.sqrt(cardValues.length))}, 1fr)`;

        cardValues.forEach(value => {
            const cardEl = document.createElement('div');
            cardEl.classList.add('card');
            cardEl.dataset.value = value.id; // Usa l'id come valore
            
            const cardInner = document.createElement('div');
            cardInner.classList.add('card-inner');

            const cardFront = document.createElement('div');
            cardFront.classList.add('card-front');

            const cardBack = document.createElement('div');
            cardBack.classList.add('card-back');
            
            // Crea un elemento immagine per il retro
            const imgEl = document.createElement('img');
            imgEl.src = value.url;
            imgEl.alt = value.id;
            cardBack.appendChild(imgEl);

            cardInner.appendChild(cardFront);
            cardInner.appendChild(cardBack);
            cardEl.appendChild(cardInner);

            cardEl.addEventListener('click', () => handleCardClick(cardEl));
            gridEl.appendChild(cardEl);
        });
    }

    // 4. Gestisce il click su una carta
    function handleCardClick(cardEl) {
        if (isChecking || cardEl.classList.contains('flipped') || cardEl.classList.contains('matched')) {
            return;
        }

        cardEl.classList.add('flipped');
        flippedCards.push(cardEl);

        if (flippedCards.length === 2) {
            moves++;
            movesCountEl.textContent = moves;
            isChecking = true;
            checkForMatch();
        }
    }

    // 5. Controlla se le due carte girate sono una coppia
    function checkForMatch() {
        const [card1, card2] = flippedCards;
        if (card1.dataset.value === card2.dataset.value) {
            // È una coppia
            card1.classList.add('matched');
            card2.classList.add('matched');
            matchedPairs++;
            flippedCards = [];
            isChecking = false;
            if (matchedPairs === totalPairs) {
                setTimeout(showGameEnd, 500);
            }
        } else {
            // Non è una coppia
            setTimeout(() => {
                card1.classList.remove('flipped');
                card2.classList.remove('flipped');
                flippedCards = [];
                isChecking = false;
            }, 1000);
        }
    }

    // 6. Avvia e gestisce il timer
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

    // 7. Mostra la schermata di fine gioco
    function showGameEnd() {
        clearInterval(timerInterval);
        finalMovesEl.textContent = moves;
        finalTimeEl.textContent = timerEl.textContent;

        // Resetta lo stato del form per una nuova partita
        if (resultForm) {
            resultForm.style.display = 'block';
            resultForm.reset();
            resultForm.querySelector('button').disabled = false;
        }
        if (formFeedback) formFeedback.style.display = 'none';

        modalEl.style.display = 'flex';
    }

    // 8. Invia i risultati al server (funzione modificata)
    async function sendResultsToServer() {
        const studentName = studentNameInput.value.trim();
        const studentEmail = studentEmailInput.value.trim();

        if (!studentName || !studentEmail) {
            alert("Nome e email sono obbligatori."); // Validazione base
            return;
        }

        const payload = {
            name: studentName,
            email: studentEmail,
            score: moves, // Invia il numero grezzo, è più utile per l'analisi
            time: timerEl.textContent,
        };

        const submitBtn = resultForm.querySelector('button');
        submitBtn.disabled = true;
        formFeedback.style.display = 'block';
        formFeedback.textContent = 'Invio in corso...';

        try {
            // L'ID del gioco viene preso dalla variabile globale `gameId`
            const response = await fetch(`/api/submit_result/${gameId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Errore di rete.');

            if (result.status === 'success') {
                formFeedback.textContent = "Risultati inviati con successo!";
                resultForm.style.display = 'none'; // Nasconde il form dopo l'invio
            } else {
                throw new Error(result.message || 'Errore sconosciuto.');
            }

        } catch (error) {
            console.error("Errore nell'invio dei risultati:", error);
            formFeedback.textContent = `Errore: ${error.message}. Riprova.`;
            submitBtn.disabled = false; // Riabilita il pulsante in caso di errore
        }
    }

    // 9. Event listeners
    playAgainBtn.addEventListener('click', () => {
        modalEl.style.display = 'none';
        initGame();
    });
    speakBtn.addEventListener('click', () => speakText(instructionTextEl.textContent));

    // Aggiungi listener per il submit del form
    if (resultForm) {
        resultForm.addEventListener('submit', (e) => {
            e.preventDefault(); // Impedisce il ricaricamento della pagina
            sendResultsToServer();
        });
    }

    // 10. Avvia il gioco
    // Usa le variabili globali `gameData` e `gameId` per inizializzare il gioco
    if (typeof gameData !== 'undefined' && gameData.images && Array.isArray(gameData.images) && gameData.images.length > 0 && typeof gameId !== 'undefined') {
        initGame();
    } else {
        const errorMsg = "Errore: impossibile caricare i dati del gioco.";
        instructionTextEl.textContent = errorMsg;
        console.error(errorMsg, "Controlla che le variabili globali 'gameData' e 'gameId' siano definite correttamente nell'HTML prima di questo script.");
        
        // Diagnostica avanzata per il debug
        if (typeof gameId === 'undefined') console.error("DEBUG: La variabile 'gameId' non è definita.");
        if (typeof gameData === 'undefined') console.error("DEBUG: La variabile 'gameData' non è definita.");
        else if (!gameData.images) console.error("DEBUG: 'gameData' è definita, ma non ha la proprietà 'images'.", gameData);
        else if (!Array.isArray(gameData.images)) console.error("DEBUG: 'gameData.images' non è un array.", gameData.images);
        else if (gameData.images.length === 0) console.error("DEBUG: 'gameData.images' è un array vuoto.");
    }
});