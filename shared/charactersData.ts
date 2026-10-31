import { CharacterDef, CharacterId } from './types';

export const CHARACTERS_DATA: Record<CharacterId, CharacterDef> = {
  benkei: {
    id: 'benkei',
    name: 'Benkei',
    title: 'Il Monaco Guerriero',
    maxHp: 5,
    abilityDescription: 'Tutti gli altri giocatori devono aggiungere +1 alla Difficoltà delle armi per attaccarti.',
    avatar: '🛡️'
  },
  chiyome: {
    id: 'chiyome',
    name: 'Chiyome',
    title: 'Maestra Kunoichi',
    maxHp: 4,
    abilityDescription: 'Puoi essere ferita solo dalle carte Arma. Sei del tutto immune agli effetti di Grido di Battaglia e Jiujitsu.',
    avatar: '🥷'
  },
  ginchiyo: {
    id: 'ginchiyo',
    name: 'Ginchiyo',
    title: 'Capoclan Coraggiosa',
    maxHp: 4,
    abilityDescription: 'Subisci 1 danno in meno del normale da ogni attacco con carta Arma (fino a un minimo di 1 danno subito).',
    avatar: '👘'
  },
  goemon: {
    id: 'goemon',
    name: 'Goemon',
    title: 'Ladro Leggendario',
    maxHp: 5,
    abilityDescription: 'Puoi giocare 1 carta Arma supplementare durante il tuo turno (es. fino a 2 armi base, o di più con Concentrazione).',
    avatar: '🎭'
  },
  hanzo: {
    id: 'hanzo',
    name: 'Hanzō',
    title: 'Maestro dell’Ombra',
    maxHp: 4,
    abilityDescription: 'Puoi giocare qualsiasi carta Arma dalla tua mano come se fosse una carta Parata (purché non sia l’unica carta che hai in mano).',
    avatar: '🗡️'
  },
  hideyoshi: {
    id: 'hideyoshi',
    name: 'Hideyoshi',
    title: 'Il Grande Unificatore',
    maxHp: 4,
    abilityDescription: 'Nella Fase di Pesca del tuo turno, peschi 1 carta supplementare dal mazzo (3 carte invece di 2).',
    avatar: '📜'
  },
  ieyasu: {
    id: 'ieyasu',
    name: 'Ieyasu',
    title: 'Fondatore dello Shogunato',
    maxHp: 5,
    abilityDescription: 'Nella tua Fase di Pesca, puoi scegliere di pescare la prima carta dalla cima della pila degli Scarti invece che dal mazzo.',
    avatar: '👑'
  },
  kojiro: {
    id: 'kojiro',
    name: 'Kojirō',
    title: 'Spadaccino Implacabile',
    maxHp: 5,
    abilityDescription: 'Le tue carte Arma possono colpire a qualsiasi Difficoltà, ignorando il valore di distanza stampato sulla carta.',
    avatar: '🦅'
  },
  musashi: {
    id: 'musashi',
    name: 'Musashi',
    title: 'Il Maestro Invitto',
    maxHp: 5,
    abilityDescription: 'Le tue carte Arma infliggono 1 danno supplementare quando colpiscono con successo un avversario.',
    avatar: '⚔️'
  },
  nobunaga: {
    id: 'nobunaga',
    name: 'Nobunaga',
    title: 'Il Re Demone',
    maxHp: 5,
    abilityDescription: 'Durante la tua Fase di Gioco, puoi scartare 1 punto Resistenza (tranne l’ultimo) per pescare 1 carta dal mazzo.',
    avatar: '🔥'
  },
  tomoe: {
    id: 'tomoe',
    name: 'Tomoe',
    title: 'Guerriera Senza Pari',
    maxHp: 5,
    abilityDescription: 'Ogni volta che ferisci con successo un altro giocatore con un’Arma, peschi 1 carta dal mazzo.',
    avatar: '🏹'
  },
  ushiwaka: {
    id: 'ushiwaka',
    name: 'Ushiwaka',
    title: 'Il Giovane Prodigio',
    maxHp: 4,
    abilityDescription: 'Ogni volta che subisci una o più ferite da una carta Arma, peschi 1 carta dal mazzo per ogni ferita subita.',
    avatar: '🍃'
  }
};

export const ALL_CHARACTERS = Object.values(CHARACTERS_DATA);
