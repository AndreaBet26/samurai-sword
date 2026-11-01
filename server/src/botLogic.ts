import { GameEngine } from './gameEngine';
import { CardDef, PlayerPrivateState, PlayerPublicState } from '../../shared/types';
import { calculateTargetDifficulty, canAttackWithWeapon } from '../../shared/rules';

/**
 * Handles automated decision-making for Bot players.
 */
export class BotAI {
  /**
   * Called when it's the bot's turn during 'play' phase.
   */
  static playTurn(engine: GameEngine, botId: string) {
    const player = engine.getPlayerPrivate(botId);
    if (!player || engine.state.status !== 'playing' || engine.state.turnPlayerId !== botId) return;

    // 1. Play Properties (Armor, Focus, Fast Draw) if held
    const propertyCards = player.hand.filter(c => c.type === 'property' && c.propertyType !== 'bushido');
    for (const prop of propertyCards) {
      engine.playProperty(botId, prop.id);
      return; // Each action triggers next step with slight natural delay
    }

    // 2. Play Healing (Respirazione) if wounded
    if (player.currentHp < player.maxHp) {
      const breathing = player.hand.find(c => c.actionType === 'breathing');
      if (breathing) {
        // Choose another player with lowest cards or harmless
        const otherPlayers = engine.state.players.filter(p => p.id !== botId);
        const target = otherPlayers[0];
        engine.playAction(botId, breathing.id, target?.id);
        return;
      }
    }

    // 3. Play Daimyo if held (draw cards)
    const daimyo = player.hand.find(c => c.actionType === 'daimyo');
    if (daimyo) {
      engine.playAction(botId, daimyo.id);
      return;
    }

    // 4. Play Tea Ceremony
    const tea = player.hand.find(c => c.actionType === 'tea_ceremony');
    if (tea) {
      engine.playAction(botId, tea.id);
      return;
    }

    // 5. Play Battle Cry or Jujutsu
    const battleCry = player.hand.find(c => c.actionType === 'battle_cry');
    if (battleCry) {
      engine.playAction(botId, battleCry.id);
      return;
    }

    const jujutsu = player.hand.find(c => c.actionType === 'jujutsu');
    if (jujutsu) {
      engine.playAction(botId, jujutsu.id);
      return;
    }

    // 6. Play Geisha or Diversion
    const diversion = player.hand.find(c => c.actionType === 'diversion');
    if (diversion) {
      const targets = engine.state.players.filter(p => p.id !== botId && p.handCount > 0);
      if (targets.length > 0) {
        const target = targets[Math.floor(Math.random() * targets.length)];
        engine.playAction(botId, diversion.id, target.id);
        return;
      }
    }

    const geisha = player.hand.find(c => c.actionType === 'geisha');
    if (geisha) {
      const targets = engine.state.players.filter(
        p => p.id !== botId && (p.handCount > 0 || p.propertiesInPlay.length > 0)
      );
      if (targets.length > 0) {
        const target = targets[0];
        // Target property if exists, else hand
        const propTarget = target.propertiesInPlay[0]?.id;
        engine.playAction(botId, geisha.id, target.id, propTarget);
        return;
      }
    }

    // 7. Play Weapon if allowed this turn
    if (player.weaponsPlayedThisTurn < player.maxWeaponsPerTurn) {
      const weapons = player.hand.filter(c => c.type === 'weapon');
      // Sort weapons by damage descending
      weapons.sort((a, b) => (b.damage ?? 1) - (a.damage ?? 1));

      for (const weapon of weapons) {
        // Find a valid target
        const possibleTargets = engine.state.players.filter(p => {
          if (p.id === botId || p.isHarmless || p.currentHp <= 0) return false;
          // Shogun bot doesn't attack known/suspected allies, but in base SS roles are hidden (except Shogun)
          const check = canAttackWithWeapon(engine.state.players, player, p, weapon);
          return check.canAttack;
        });

        if (possibleTargets.length > 0) {
          // Attack the target with lowest HP
          possibleTargets.sort((a, b) => a.currentHp - b.currentHp);
          const chosenTarget = possibleTargets[0];
          engine.attackWithWeapon(botId, weapon.id, chosenTarget.id);
          return;
        }
      }
    }

    // 8. Play Bushido if held
    const bushido = player.hand.find(c => c.propertyType === 'bushido');
    if (bushido) {
      const targets = engine.state.players.filter(p => p.id !== botId && !p.isHarmless);
      if (targets.length > 0) {
        engine.playAction(botId, bushido.id, targets[0].id);
        return;
      }
    }

    // Nobunaga ability: if HP >= 4 and cards <= 2, sacrifice 1 HP to draw
    if (player.character?.id === 'nobunaga' && player.currentHp >= 4 && player.hand.length <= 2) {
      engine.useNobunagaAbility(botId);
      return;
    }

    // No more meaningful actions -> End turn (move to discard phase or pass)
    engine.endPlayPhase(botId);
  }

  /**
   * Called when bot is asked to respond to a reaction (Parata or Jujutsu or Battle Cry).
   */
  static respondToReaction(engine: GameEngine, botId: string) {
    const reaction = engine.state.pendingReaction;
    if (!reaction || reaction.pendingForPlayerId !== botId) return;

    const player = engine.getPlayerPrivate(botId);
    if (!player) return;

    if (reaction.type === 'parry_weapon') {
      // Find a Parry card (or Hanzo weapon card)
      const parryCard = player.hand.find(c => c.actionType === 'parry');
      if (parryCard) {
        engine.submitReaction(botId, parryCard.id);
        return;
      }
      // Hanzo ability: can use weapon as parry if not last card
      if (player.character?.id === 'hanzo' && player.hand.length > 1) {
        const weaponAsParry = player.hand.find(c => c.type === 'weapon');
        if (weaponAsParry) {
          engine.submitReaction(botId, weaponAsParry.id);
          return;
        }
      }
      // Take the damage
      engine.submitReaction(botId, null);
    } else if (reaction.type === 'battle_cry') {
      // Grido di Battaglia: la regola impone esclusivamente lo scarto di una Parata (nessuna arma)
      const parryCard = player.hand.find(c => c.actionType === 'parry');
      if (parryCard) {
        engine.submitReaction(botId, parryCard.id);
      } else {
        engine.submitReaction(botId, null);
      }
    } else if (reaction.type === 'jujutsu') {
      // Discard a weapon card if available
      const weaponCard = player.hand.find(c => c.type === 'weapon');
      if (weaponCard) {
        engine.submitReaction(botId, weaponCard.id);
      } else {
        engine.submitReaction(botId, null);
      }
    }
  }

  /**
   * Called when bot needs to discard down to HP limit.
   */
  static discardDown(engine: GameEngine, botId: string) {
    const player = engine.getPlayerPrivate(botId);
    if (!player) return;

    const maxHandLimit = 7;
    const excess = player.hand.length - maxHandLimit;
    if (excess <= 0) {
      engine.finishTurn(botId);
      return;
    }

    // Discard least useful cards first (e.g. extra duplicate weapons)
    const cardsToDiscard = player.hand.slice(0, excess).map(c => c.id);
    engine.discardExcessCards(botId, cardsToDiscard);
  }
}
