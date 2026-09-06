// public/roll20-importer.js
// Hosted / Inlined Bookmarklet Engine for Adventurer's Ledger -> Roll20 Jumpgate VTT
(function () {
  'use strict';

  // 1. Universally locate Roll20 Jumpgate / Classic engine across window, parent, top, opener
  function getRoll20Engine() {
    const scopes = [
      typeof window !== 'undefined' ? window : null,
      typeof window !== 'undefined' ? window.parent : null,
      typeof window !== 'undefined' ? window.top : null,
      typeof window !== 'undefined' ? window.opener : null
    ].filter(Boolean);

    for (let i = 0; i < scopes.length; i++) {
      const s = scopes[i];
      if (s.Campaign && s.Campaign.characters) {
        return { Campaign: s.Campaign, d20: s.d20, root: s };
      }
      if (s.d20 && s.d20.Campaign && s.d20.Campaign.characters) {
        return { Campaign: s.d20.Campaign, d20: s.d20, root: s };
      }
    }
    return null;
  }

  const engine = getRoll20Engine();
  if (!engine) {
    alert('Could not locate Roll20 Campaign engine in window, parent, or top.\n\nMake sure your Roll20 game tab is active.');
    return;
  }

  if (window.__ledgerModal) {
    window.__ledgerModal.style.display = 'block';
    return;
  }

  // 2. Decode character from Ledger compressed share payload or single-item JSON
  async function parseSharePayload(tokenOrUrl) {
    const raw = tokenOrUrl.split('#share=')[1] || tokenOrUrl;
    if (raw.startsWith('{')) {
      return JSON.parse(raw);
    }
    const isDeflated = raw[0] === '1';
    const b64 = raw.slice(1).replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, function (c) { return c.charCodeAt(0); });

    if (isDeflated && typeof DecompressionStream !== 'undefined') {
      const ds = new DecompressionStream('deflate-raw');
      const writer = ds.writable.getWriter();
      writer.write(bytes);
      writer.close();
      const decompressed = await new Response(ds.readable).arrayBuffer();
      return JSON.parse(new TextDecoder().decode(decompressed));
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  // 3. Duplicate Checker across Roll20 Repeating Sections
  function checkDuplicate(targetChar, itemName, category) {
    if (!targetChar || !targetChar.attribs || !targetChar.attribs.models) return null;
    const cleanName = itemName.trim().toLowerCase();

    for (let i = 0; i < targetChar.attribs.models.length; i++) {
      const attr = targetChar.attribs.models[i];
      const attrName = (attr.get('name') || '').toLowerCase();
      const attrVal = String(attr.get('current') || '').trim().toLowerCase();

      if (attrVal === cleanName) {
        if (category === 'Spells' && attrName.indexOf('repeating_spell-') === 0 && attrName.indexOf('_spellname') > -1) {
          return 'Spells list';
        }
        if ((category === 'Features' || category === 'Traits') && attrName.indexOf('repeating_traits_') === 0 && attrName.indexOf('_name') > -1) {
          return 'Features & Traits';
        }
        if (category === 'Items' && attrName.indexOf('repeating_inventory_') === 0 && attrName.indexOf('_itemname') > -1) {
          return 'Inventory';
        }
        if (category === 'Attacks' && attrName.indexOf('repeating_attack_') === 0 && attrName.indexOf('_atkname') > -1) {
          return 'Attacks list';
        }
      }
    }
    return null;
  }

  // 4. Construct In-Game HUD Modal
  const modal = document.createElement('div');
  window.__ledgerModal = modal;
  modal.style.cssText = 'position:fixed;top:65px;right:25px;width:370px;background:#18181f;color:#e8e8e8;border:2px solid #b89758;border-radius:10px;padding:20px;z-index:9999999;box-shadow:0 12px 36px rgba(0,0,0,0.85);font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;';

  modal.innerHTML = [
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid #333;padding-bottom:8px;">',
      '<div style="color:#d4af37;font-family:Georgia,serif;font-size:18px;font-weight:bold;">Adventurer\'s Ledger Sync</div>',
      '<button id="ledger-close" style="background:none;border:none;color:#888;font-size:20px;cursor:pointer;line-height:1;">✕</button>',
    '</div>',
    '<div id="ledger-status" style="font-size:13px;color:#aaa;margin-bottom:14px;line-height:1.4;">Reading clipboard...</div>',
    '<div id="ledger-content" style="display:none;">',
      '<label style="font-size:12px;color:#aaa;display:block;margin-bottom:6px;">Target Roll20 Character:</label>',
      '<select id="ledger-target" style="width:100%;padding:8px;background:#24242e;color:#fff;border:1px solid #444;border-radius:5px;margin-bottom:14px;font-size:13px;"></select>',
      '<div style="font-size:12px;background:#20202a;padding:10px;border-radius:6px;margin-bottom:14px;">',
        '<label style="display:block;margin-bottom:6px;cursor:pointer;"><input type="checkbox" id="sync-stats" checked> Base Stats, HP & Saves</label>',
        '<label style="display:block;margin-bottom:6px;cursor:pointer;"><input type="checkbox" id="sync-skills" checked> Skills & Proficiencies</label>',
        '<label style="display:block;margin-bottom:6px;cursor:pointer;"><input type="checkbox" id="sync-spells" checked> Spells (with duplicate checking)</label>',
      '</div>',
      '<button id="ledger-apply" style="width:100%;padding:10px;background:#b89758;border:none;border-radius:6px;color:#111;font-weight:bold;font-size:14px;cursor:pointer;">Apply to Character Sheet</button>',
    '</div>'
  ].join('');
  document.body.appendChild(modal);

  modal.querySelector('#ledger-close').onclick = function () { modal.style.display = 'none'; };

  // 5. Read Clipboard or Prompt Fallback
  (async function () {
    let raw = '';
    try {
      raw = await navigator.clipboard.readText();
    } catch (_) {}

    if (!raw || (!raw.includes('#share=') && !raw.includes('name'))) {
      raw = prompt('Paste your Adventurer\'s Ledger share link or spell/feature JSON:', raw || '');
    }

    if (!raw || !raw.trim()) {
      modal.querySelector('#ledger-status').innerHTML = '<span style="color:#d76a76;">No Ledger data provided.</span>';
      return;
    }

    try {
      const payload = await parseSharePayload(raw.trim());
      const isSingleItem = payload.type === 'drop' || (payload.data && payload.data.Category);
      const ch = isSingleItem ? null : (payload.c || payload);

      if (isSingleItem) {
        const itemName = payload.name || payload.data.Name;
        const itemCat = payload.category || payload.data.Category || 'Spells';
        modal.querySelector('#ledger-status').innerHTML = '<span style="color:#50fa7b;">✓</span> Single Item Ready: <strong>' + itemName + '</strong> (' + itemCat + ')';
      } else {
        modal.querySelector('#ledger-status').innerHTML = '<span style="color:#50fa7b;">✓</span> Loaded: <strong>' + (ch.name || 'Character') + '</strong> (' + (ch.race || '') + ' ' + ((ch.classes || []).map(function (c) { return c.name + ' ' + c.level; }).join('/')) + ')';
      }

      // Populate Character Selector
      const select = modal.querySelector('#ledger-target');
      const openDialogId = (engine.root.$ && engine.root.$('.characterdialog[data-characterid]').attr('data-characterid'))
        || (typeof d20 !== 'undefined' && d20.characterId)
        || '-P0-YTDWf4hl2JoGrHjE';

      const chars = engine.Campaign.characters.models || [];
      chars.forEach(function (m) {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.innerText = m.get('name') || 'Unnamed Character';
        if (m.id === openDialogId) opt.selected = true;
        else if (!openDialogId && ch && ch.name && opt.innerText.trim().toLowerCase() === ch.name.trim().toLowerCase()) opt.selected = true;
        select.appendChild(opt);
      });

      modal.querySelector('#ledger-content').style.display = 'block';

      modal.querySelector('#ledger-apply').onclick = async function () {
        const btn = modal.querySelector('#ledger-apply');
        btn.disabled = true;
        btn.innerText = 'Applying updates...';

        const targetChar = engine.Campaign.characters.get(select.value);

        if (isSingleItem) {
          const itemName = payload.name || payload.data.Name;
          const itemCat = payload.category || payload.data.Category || 'Spells';
          const dupSection = checkDuplicate(targetChar, itemName, itemCat);

          if (dupSection) {
            const proceed = confirm('⚠️ Duplicate detected!\n\n"' + itemName + '" already exists in ' + (targetChar.get('name') || 'character') + '\'s ' + dupSection + '.\n\nDo you want to re-add / overwrite it anyway?');
            if (!proceed) {
              btn.disabled = false;
              btn.innerText = 'Apply to Character Sheet';
              return;
            }
          }

          injectDropItem(targetChar, payload);
          btn.innerText = 'Added ' + itemName + ' ✓';
          btn.style.background = '#50fa7b';
          setTimeout(function () { modal.style.display = 'none'; }, 1500);
          return;
        }

        // Full character sync
        await executeFullSync(targetChar, ch, {
          stats: modal.querySelector('#sync-stats').checked,
          skills: modal.querySelector('#sync-skills').checked,
          spells: modal.querySelector('#sync-spells').checked
        });

        btn.innerText = 'Sync Complete ✓';
        btn.style.background = '#50fa7b';
        setTimeout(function () { modal.style.display = 'none'; }, 1500);
      };
    } catch (err) {
      modal.querySelector('#ledger-status').innerHTML = '<span style="color:#d76a76;">Error: ' + err.message + '</span>';
    }
  })();

  // 6. Inject Single Drop Item (Spell, Feature, Weapon)
  function injectDropItem(char, item) {
    const setAttr = function (name, val) {
      let a = char.attribs.find(function (x) { return x.get('name').toLowerCase() === name.toLowerCase(); });
      if (!a) a = char.attribs.create({ name: name });
      a.syncedSave({ current: String(val) });
    };

    const name = item.name || (item.data && item.data.Name);
    const category = item.category || (item.data && item.data.Category) || 'Spells';
    const content = item.content || (item.data && item.data['data-description']) || '';
    const data = item.data || item;

    setAttr('drop_name', name);
    setAttr('drop_content', content);
    setAttr('drop_data', typeof data === 'string' ? data : JSON.stringify(data));
    setAttr('drop_category', category);
  }

  // 7. Full Character Sync Engine
  async function executeFullSync(char, ch, opts) {
    function setAttr(name, current, max) {
      let a = char.attribs.find(function (x) { return x.get('name').toLowerCase() === name.toLowerCase(); });
      if (!a) a = char.attribs.create({ name: name });
      const patch = { current: String(current) };
      if (typeof max !== 'undefined' && max !== null) patch.max = String(max);
      a.syncedSave(patch);
    }

    if (opts.stats) {
      if (ch.name) setAttr('character_name', ch.name);
      if (ch.race) setAttr('race', ch.race);
      if (ch.background) setAttr('background', ch.background);
      if (ch.alignment) setAttr('alignment', ch.alignment);

      if (ch.classes && ch.classes.length > 0) {
        setAttr('class', ch.classes[0].name);
        if (ch.classes[0].subclass) setAttr('subclass', ch.classes[0].subclass);
        setAttr('base_level', ch.classes[0].level);
      }

      if (ch.abilities) {
        setAttr('strength_base', ch.abilities.str);
        setAttr('dexterity_base', ch.abilities.dex);
        setAttr('constitution_base', ch.abilities.con);
        setAttr('intelligence_base', ch.abilities.int);
        setAttr('wisdom_base', ch.abilities.wis);
        setAttr('charisma_base', ch.abilities.cha);
      }

      if (typeof ch.maxHp === 'number') {
        const curHp = Math.max(0, ch.maxHp - (ch.dmg || 0));
        setAttr('hp', curHp, ch.maxHp);
      }
      if (typeof ch.tempHp === 'number') {
        setAttr('hp_temp', ch.tempHp);
      }
    }

    if (opts.skills && Array.isArray(ch.skills)) {
      const skills = [
        'acrobatics', 'animal_handling', 'arcana', 'athletics', 'deception',
        'history', 'insight', 'intimidation', 'investigation', 'medicine',
        'nature', 'perception', 'performance', 'persuasion', 'religion',
        'sleight_of_hand', 'stealth', 'survival'
      ];
      skills.forEach(function (sk) {
        const title = sk.split('_').map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ');
        const isProf = ch.skills.includes(title);
        const isExp = Array.isArray(ch.expertise) && ch.expertise.includes(title);
        setAttr(sk + '_prof', isProf || isExp ? '(@{pb}*@{' + sk + '_type})' : '0');
        setAttr(sk + '_type', isExp ? '2' : '1');
      });
    }

    if (opts.spells && Array.isArray(ch.spells) && ch.spells.length > 0) {
      for (let i = 0; i < ch.spells.length; i++) {
        const spellName = ch.spells[i];
        const isDup = checkDuplicate(char, spellName, 'Spells');
        if (isDup) continue; // Skip duplicates automatically during bulk sync

        setAttr('drop_name', spellName);
        setAttr('drop_data', JSON.stringify({ Name: spellName, Category: 'Spells' }));
        setAttr('drop_category', 'Spells');
        await new Promise(function (resolve) { setTimeout(resolve, 450); });
      }
    }

    if (typeof ch.gold === 'number') {
      setAttr('gp', Math.floor(ch.gold));
    }
  }
})();
