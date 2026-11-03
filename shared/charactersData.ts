import { CharacterDef, CharacterId } from './types';

export const CHARACTERS_DATA: Record<CharacterId, CharacterDef> = {
  benkei: {
    id: 'benkei',
    shortAbility: "+1 alla Difficoltà per colpirlo",
    name: 'Benkei',
    title: 'Il Monaco Guerriero',
    maxHp: 5,
    abilityDescription: 'Tutti gli altri giocatori devono aggiungere +1 alla Difficoltà delle armi per attaccarti.',
    avatar: '🛡️'
  },
  chiyome: {
    id: 'chiyome',
    shortAbility: "ferita solo dalle armi",
    name: 'Chiyome',
    title: 'Maestra Kunoichi',
    maxHp: 4,
    abilityDescription: 'Puoi essere ferita solo dalle carte Arma. Sei del tutto immune agli effetti di Grido di Battaglia e Jiujitsu.',
    avatar: '🥷'
  },
  ginchiyo: {
    id: 'ginchiyo',
    shortAbility: "−1 danno dalle armi (min. 1)",
    name: 'Ginchiyo',
    title: 'Capoclan Coraggiosa',
    maxHp: 4,
    abilityDescription: 'Subisci 1 danno in meno del normale da ogni attacco con carta Arma (fino a un minimo di 1 danno subito).',
    avatar: '👘'
  },
  goemon: {
    id: 'goemon',
    shortAbility: "una seconda arma per turno",
    name: 'Goemon',
    title: 'Ladro Leggendario',
    maxHp: 5,
    abilityDescription: 'Puoi giocare 1 carta Arma supplementare durante il tuo turno (es. fino a 2 armi base, o di più con Concentrazione).',
    avatar: '🎭'
  },
  hanzo: {
    id: 'hanzo',
    shortAbility: "può parare con un'arma",
    name: 'Hanzō',
    title: 'Maestro dell’Ombra',
    maxHp: 4,
    abilityDescription: 'Puoi giocare qualsiasi carta Arma dalla tua mano come se fosse una carta Parata (purché non sia l’unica carta che hai in mano).',
    avatar: '🗡️'
  },
  hideyoshi: {
    id: 'hideyoshi',
    shortAbility: "pesca una carta in più",
    name: 'Hideyoshi',
    title: 'Il Grande Unificatore',
    maxHp: 4,
    abilityDescription: 'Nella Fase di Pesca del tuo turno, peschi 1 carta supplementare dal mazzo (3 carte invece di 2).',
    avatar: '📜'
  },
  ieyasu: {
    id: 'ieyasu',
    shortAbility: "può pescare dagli scarti",
    name: 'Ieyasu',
    title: 'Fondatore dello Shogunato',
    maxHp: 5,
    abilityDescription: 'Nella tua Fase di Pesca, puoi scegliere di pescare la prima carta dalla cima della pila degli Scarti invece che dal mazzo.',
    avatar: '👑'
  },
  kojiro: {
    id: 'kojiro',
    shortAbility: "le sue armi colpiscono ovunque",
    name: 'Kojirō',
    title: 'Spadaccino Implacabile',
    maxHp: 5,
    abilityDescription: 'Le tue carte Arma possono colpire a qualsiasi Difficoltà, ignorando il valore di distanza stampato sulla carta.',
    avatar: '🦅'
  },
  musashi: {
    id: 'musashi',
    shortAbility: "+1 danno con le armi",
    name: 'Musashi',
    title: 'Il Maestro Invitto',
    maxHp: 5,
    abilityDescription: 'Le tue carte Arma infliggono 1 danno supplementare quando colpiscono con successo un avversario.',
    avatar: '⚔️'
  },
  nobunaga: {
    id: 'nobunaga',
    shortAbility: "1 Vita per pescare una carta",
    name: 'Nobunaga',
    title: 'Il Re Demone',
    maxHp: 5,
    abilityDescription: 'Durante la tua Fase di Gioco, puoi scartare 1 punto Resistenza (tranne l’ultimo) per pescare 1 carta dal mazzo.',
    avatar: '🔥'
  },
  tomoe: {
    id: 'tomoe',
    shortAbility: "pesca quando ferisce con un'arma",
    name: 'Tomoe',
    title: 'Guerriera Senza Pari',
    maxHp: 5,
    abilityDescription: 'Ogni volta che ferisci con successo un altro giocatore con un’Arma, peschi 1 carta dal mazzo.',
    avatar: '🏹'
  },
  ushiwaka: {
    id: 'ushiwaka',
    shortAbility: "pesca per ogni ferita da arma",
    name: 'Ushiwaka',
    title: 'Il Giovane Prodigio',
    maxHp: 4,
    abilityDescription: 'Ogni volta che subisci una o più ferite da una carta Arma, peschi 1 carta dal mazzo per ogni ferita subita.',
    avatar: '🍃'
  }
};

export const ALL_CHARACTERS = Object.values(CHARACTERS_DATA);
