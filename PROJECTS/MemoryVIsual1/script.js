// --- DATI DEL GIOCO ---
// Modifica questo array per cambiare le carte del gioco.
// Inserisci 8 elementi. Il gioco creerà le coppie automaticamente.
// Per le coppie, assicurati che la lunghezza di `cardItems1` e `cardItems2` sia la stessa.
// Gli elementi in `cardItems1` e `cardItems2` alla stessa posizione di indice formeranno una coppia.
const cardItems1 = [
    'Pane', 'Acqua', 'Mela', 'Libro',
    'Gatto', 'Cane', 'Sole', 'Luna'
];
const cardItems2 = [
    'Bread', 'Water', 'Apple', 'Book',
    'Cat', 'Dog', 'Sun', 'Moon'
];

// --- LOGICA DEL GIOCO ---
// (Non modificare il codice qui sotto se non sai cosa stai facendo)

const gameBoard = document.querySelector('.game-board');
const movesCountSpan = document.getElementById('moves-count');
const resetButton = document.getElementById('reset-btn');
const timerSpan = document.getElementById('timer');
const modal = document.getElementById('end-game-modal');
const finalMovesSpan = document.getElementById('final-moves');
const finalTimeSpan = document.getElementById('final-time');
const playAgainButton = document.getElementById('play-again-btn');

let gameData = []; // Questo array conterrà gli oggetti { display: '...', match: '...' }

// Crea le coppie di dati
for (let i = 0; i < cardItems1.length; i++) {
    gameData.push({ display: cardItems1[i], match: `pair-${i}` });
    gameData.push({ display: cardItems2[i], match: `pair-${i}` });
}

let studentInfo = {};
// Recupera i dati dello studente dall'URL
const urlParams = new URLSearchParams(window.location.search);
studentInfo = { name: urlParams.get('name'), email: urlParams.get('email') };

let firstCard = null;
let secondCard = null;
let lockBoard = false;
let moves = 0;
let matchedPairs = 0;
let timerInterval = null;
let seconds = 0;

function shuffle(array) {
    array.sort(() => 0.5 - Math.random());
}

function createBoard() {
    shuffle(gameData);
    gameBoard.innerHTML = '';
    moves = 0;
    matchedPairs = 0;
    movesCountSpan.textContent = moves;
    modal.style.display = 'none';
 
    gameData.forEach(item => {
        const card = document.createElement('div'); // Crea un elemento div per la carta
        card.classList.add('card'); // Aggiunge la classe 'card'
        card.dataset.match = item.match; // Usa un attributo data-match per l'abbinamento

        card.innerHTML = `
            <div class="card-face card-front">${item.display}</div>
            <div class="card-face card-back">?</div>
        `;

        card.addEventListener('click', flipCard);
        gameBoard.appendChild(card);
    });

    resetTurn();
    startTimer();
}

function startTimer() {
    clearInterval(timerInterval);
    seconds = 0;
    timerSpan.textContent = '00:00';
    timerInterval = setInterval(() => {
        seconds++;
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        timerSpan.textContent = `${mins}:${secs}`;
    }, 1000);
}

function flipCard() {
    if (lockBoard) return;
    if (this === firstCard) return;

    this.classList.add('flipped');

    if (!firstCard) {
        firstCard = this;
        return;
    }

    secondCard = this;
    moves++;
    movesCountSpan.textContent = moves;
    checkForMatch();
}

function checkForMatch() {
    lockBoard = true;
    const isMatch = firstCard.dataset.match === secondCard.dataset.match; // Controlla l'attributo data-match
    isMatch ? disableCards() : unflipCards();
}

function disableCards() {
    firstCard.removeEventListener('click', flipCard);
    secondCard.removeEventListener('click', flipCard);

    matchedPairs++;
    if (matchedPairs === gameData.length / 2) {
        endGame();
    }

    resetTurn();
}

function endGame() {
    clearInterval(timerInterval); // Ferma il timer
    finalMovesSpan.textContent = moves;
    finalTimeSpan.textContent = timerSpan.textContent;
    
    // Invia i risultati automaticamente
    sendResultsToServer();

    setTimeout(() => modal.style.display = 'flex', 500); // Mostra il modale con un piccolo ritardo
}

async function sendResultsToServer() {
    // Invia solo se nome e email sono presenti
    if (!studentInfo.name || !studentInfo.email) {
        console.log("Dati studente non trovati, invio email saltato.");
        return;
    }

    // Ottieni il nome del progetto dall'URL
    const pathParts = window.location.pathname.split('/');
    const projectName = pathParts[pathParts.length - 2];

    // Prepara il payload da inviare al backend
    const payload = {
        ...studentInfo,
        score: moves, // Per il memory, il "punteggio" sono le mosse
        time: timerSpan.textContent
    };

    // Invia i dati al backend
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

function unflipCards() {
    setTimeout(() => {
        firstCard.classList.remove('flipped');
        secondCard.classList.remove('flipped');
        resetTurn();
    }, 1000);
}

function resetTurn() {
    [firstCard, secondCard] = [null, null];
    lockBoard = false;
}

resetButton.addEventListener('click', createBoard);
playAgainButton.addEventListener('click', createBoard);

// Avvia il gioco
createBoard();
