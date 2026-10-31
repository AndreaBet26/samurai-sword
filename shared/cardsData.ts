import { CardDef, WeaponCardName, PropertyCardName, ActionCardName } from './types';

export interface CardTemplate {
  templateId: string;
  name: WeaponCardName | PropertyCardName | ActionCardName;
  type: 'weapon' | 'property' | 'action';
  description: string;
  difficulty?: number;
  damage?: number;
  actionType?:
    | 'parry'
    | 'tea_ceremony'
    | 'daimyo'
    | 'diversion'
    | 'geisha'
    | 'battle_cry'
    | 'jujutsu'
    | 'breathing';
  propertyType?: 'armor' | 'focus' | 'fast_draw' | 'bushido';
  count: number;
}

export const CARD_TEMPLATES: CardTemplate[] = [
  // --- WEAPONS (32 cards) ---
  {
    templateId: 'bokken',
    name: 'Bokken',
    type: 'weapon',
    difficulty: 1,
    damage: 1,
    description: 'Spada di legno da addestramento. Colpisce a distanza 1, infligge 1 ferita.',
    count: 6
  },
  {
    templateId: 'bo',
    name: 'Bo',
    type: 'weapon',
    difficulty: 2,
    damage: 1,
    description: 'Lungo bastone di legno. Colpisce a distanza 2, infligge 1 ferita.',
    count: 5
  },
  {
    templateId: 'kiseru',
    name: 'Kiseru',
    type: 'weapon',
    difficulty: 1,
    damage: 2,
    description: 'Pipa di metallo usata come arma ravvicinata. Colpisce a distanza 1, infligge 2 ferite.',
    count: 5
  },
  {
    templateId: 'kusarigama',
    name: 'Kusarigama',
    type: 'weapon',
    difficulty: 2,
    damage: 2,
    description: 'Falce con catena e peso di ferro. Colpisce a distanza 2, infligge 2 ferite.',
    count: 4
  },
  {
    templateId: 'katana',
    name: 'Katana',
    type: 'weapon',
    difficulty: 2,
    damage: 3,
    description: 'La leggendaria spada dei samurai. Colpisce a distanza 2, infligge 3 ferite devastanti.',
    count: 1
  },
  {
    templateId: 'shuriken',
    name: 'Shuriken',
    type: 'weapon',
    difficulty: 3,
    damage: 1,
    description: 'Stelle metalliche da lancio. Colpiscono a distanza 3, infliggono 1 ferita.',
    count: 3
  },
  {
    templateId: 'kanabo',
    name: 'Kanabo',
    type: 'weapon',
    difficulty: 3,
    damage: 2,
    description: 'Pesante mazza di ferro con borchie. Colpisce a distanza 3, infligge 2 ferite.',
    count: 1
  },
  {
    templateId: 'nodachi',
    name: 'Nodachi',
    type: 'weapon',
    difficulty: 3,
    damage: 3,
    description: 'Enorme spadone da campo a due mani. Colpisce a distanza 3, infligge 3 ferite.',
    count: 1
  },
  {
    templateId: 'naginata',
    name: 'Naginata',
    type: 'weapon',
    difficulty: 4,
    damage: 1,
    description: 'Lancia tradizionale con lama ricurva. Colpisce a distanza 4, infligge 1 ferita.',
    count: 2
  },
  {
    templateId: 'nagayari',
    name: 'Nagayari',
    type: 'weapon',
    difficulty: 4,
    damage: 2,
    description: 'Lunghissima picca da cavalleria. Colpisce a distanza 4, infligge 2 ferite.',
    count: 1
  },
  {
    templateId: 'tanegashima',
    name: 'Tanegashima',
    type: 'weapon',
    difficulty: 5,
    damage: 1,
    description: 'Archibugio a miccia. Colpisce a distanza 5, infligge 1 ferita.',
    count: 1
  },
  {
    templateId: 'daikyu',
    name: 'Daikyu',
    type: 'weapon',
    difficulty: 5,
    damage: 2,
    description: 'Arco asimmetrico da guerra. Colpisce a distanza 5, infligge 2 ferite.',
    count: 1
  },
  {
    templateId: 'wakizashi',
    name: 'Wakizashi',
    type: 'weapon',
    difficulty: 1,
    damage: 3,
    description: 'Spada corta compagna da duello. Colpisce a distanza 1, infligge 3 ferite.',
    count: 1
  },

  // --- PROPERTIES (15 cards) ---
  {
    templateId: 'armatura',
    name: 'Armatura',
    type: 'property',
    propertyType: 'armor',
    description: 'Rimane davanti a te. Aumenta di +1 la Difficoltà per tutti gli altri giocatori che intendono attaccarti con un’arma.',
    count: 4
  },
  {
    templateId: 'concentrazione',
    name: 'Concentrazione',
    type: 'property',
    propertyType: 'focus',
    description: 'Rimane davanti a te. Ti permette di giocare 1 carta Arma supplementare durante il tuo turno per ciascuna Concentrazione in gioco.',
    count: 6
  },
  {
    templateId: 'estrazione_rapida',
    name: 'Estrazione Rapida',
    type: 'property',
    propertyType: 'fast_draw',
    description: 'Rimane davanti a te. Le tue carte Arma infliggono 1 danno supplementare quando colpiscono con successo un avversario.',
    count: 3
  },
  {
    templateId: 'bushido',
    name: 'Bushido',
    type: 'property',
    propertyType: 'bushido',
    description: 'Si gioca davanti a qualsiasi giocatore. Al termine del suo Recupero, scopre la prima carta del mazzo: se è un’Arma, deve scartare un’Arma o perde 1 Onore.',
    count: 2
  },

  // --- ACTIONS (43 cards) ---
  {
    templateId: 'parata',
    name: 'Parata',
    type: 'action',
    actionType: 'parry',
    description: 'Si gioca immediatamente in risposta a un attacco con arma per annullarne completamente gli effetti e i danni.',
    count: 15
  },
  {
    templateId: 'cerimonia_del_te',
    name: 'Cerimonia del Tè',
    type: 'action',
    actionType: 'tea_ceremony',
    description: 'Peschi 3 carte dal mazzo. Ogni altro giocatore ne pesca 1.',
    count: 4
  },
  {
    templateId: 'daimyo',
    name: 'Daimyo',
    type: 'action',
    actionType: 'daimyo',
    description: 'Peschi 2 carte dal mazzo. Se la tieni in mano fino a fine partita, vale 1 Punto Onore supplementare (tranne per il Ronin).',
    count: 3
  },
  {
    templateId: 'diversione',
    name: 'Diversione',
    type: 'action',
    actionType: 'diversion',
    description: 'Peschi 1 carta a caso dalla mano di un qualsiasi giocatore a tua scelta (a qualsiasi distanza).',
    count: 4
  },
  {
    templateId: 'geisha',
    name: 'Geisha',
    type: 'action',
    actionType: 'geisha',
    description: 'Costringi un qualsiasi giocatore a scartare 1 carta a tua scelta tra le sue Proprietà in gioco, oppure 1 a caso dalla sua mano.',
    count: 6
  },
  {
    templateId: 'grido_di_battaglia',
    name: 'Grido di Battaglia',
    type: 'action',
    actionType: 'battle_cry',
    description: 'Tutti gli altri giocatori devono scegliere se scartare una Parata o perdere 1 punto Resistenza.',
    count: 4
  },
  {
    templateId: 'jiujitsu',
    name: 'Jiujitsu',
    type: 'action',
    actionType: 'jujutsu',
    description: 'Tutti gli altri giocatori devono scegliere se scartare una carta Arma o perdere 1 punto Resistenza.',
    count: 3
  },
  {
    templateId: 'respirazione',
    name: 'Respirazione',
    type: 'action',
    actionType: 'breathing',
    description: 'Recuperi immediatamente tutti i tuoi punti Resistenza perduti. Poi un altro giocatore a tua scelta pesca 1 carta dal mazzo.',
    count: 4
  }
];

export function buildDeck(): CardDef[] {
  const deck: CardDef[] = [];
  let index = 1;
  for (const t of CARD_TEMPLATES) {
    for (let i = 0; i < t.count; i++) {
      deck.push({
        id: `${t.templateId}_${index++}`,
        templateId: t.templateId,
        name: t.name,
        type: t.type,
        description: t.description,
        difficulty: t.difficulty,
        damage: t.damage,
        actionType: t.actionType,
        propertyType: t.propertyType
      });
    }
  }
  return shuffleArray(deck);
}

export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
