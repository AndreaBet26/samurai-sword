# Suoni personalizzati (facoltativo)

Il gioco genera già tutti i suoni da solo. Se vuoi sostituirne qualcuno con un file audio:

1. Copia i file (`.mp3`, `.ogg` o `.wav`) in questa cartella.
2. Crea qui un file `sounds.json` che dice quale file usare per ogni effetto, per esempio:

```json
{
  "parry": "parata.mp3",
  "swordHit": "colpo-spada.ogg",
  "yourTurn": "tuo-turno.wav"
}
```

Effetti disponibili: `cardHover`, `cardDraw`, `cardPlace`, `shuffle`, `uiClick`, `swordDraw`,
`swordHit`, `parry`, `damage`, `defeat`, `gong`, `honorGain`, `honorLoss`, `heal`, `tokenDrop`,
`yourTurn`, `battleCry`, `victory`.

Gli effetti senza file continuano a usare il suono generato dal gioco.
