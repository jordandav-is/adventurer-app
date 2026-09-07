// public/roll20-importer.js
// Self-contained Bookmarklet & Console Engine for Adventurer's Ledger -> Roll20 Jumpgate / Classic OGL 5e
(function () {
  'use strict';

  // 1. Safe Multi-Scope Engine Resolver (Cross-Origin & Iframe Resilient)
  function getRoll20Engine() {
    const candidateScopes = [
      typeof window !== 'undefined' ? window : null,
      typeof window !== 'undefined' ? window.parent : null,
      typeof window !== 'undefined' ? window.top : null,
      typeof window !== 'undefined' ? window.opener : null
    ].filter(Boolean);

    for (let i = 0; i < candidateScopes.length; i++) {
      try {
        const s = candidateScopes[i];
        if (s && s.Campaign && s.Campaign.characters && s.Campaign.characters.models) {
          return { Campaign: s.Campaign, d20: s.d20, root: s };
        }
        if (s && s.d20 && s.d20.Campaign && s.d20.Campaign.characters && s.d20.Campaign.characters.models) {
          return { Campaign: s.d20.Campaign, d20: s.d20, root: s };
        }
      } catch (_) {
        // Suppress cross-origin WindowProxy SecurityErrors
      }
    }
    return null;
  }

  const engine = getRoll20Engine();
  if (!engine) {
    alert('Could not locate the Roll20 Campaign engine in window, parent, or top.\n\nMake sure your Roll20 VTT game tab is open and active.');
    return;
  }

  // 2. Standard Roll20 Push ID Generator for Repeating Rows
  function generateRowID() {
    const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
    let id = '-';
    let now = new Date().getTime();
    for (let i = 7; i >= 0; i--) {
      id += PUSH_CHARS.charAt(Math.floor(now / Math.pow(64, i)) % 64);
    }
    for (let i = 0; i < 12; i++) {
      id += PUSH_CHARS.charAt(Math.floor(Math.random() * 64));
    }
    return id;
  }

  // 3. Robust String Normalizer
  function norm(str) {
    const s = String(str || '');
    return (s.normalize ? s.normalize('NFKC') : s).trim().toLowerCase().replace(/\s+/g, ' ');
  }

  // 4. Decode Ledger Share Token (Compressed or Raw JSON)
  async function parseSharePayload(rawText) {
    const trimmed = (rawText || '').trim();
    if (!trimmed) throw new Error('No data provided');

    const shareMatch = trimmed.match(/#share=([0-9A-Za-z_-]+)/);
    const token = shareMatch ? shareMatch[1] : trimmed;

    if (token.startsWith('{') || token.startsWith('[')) {
      return JSON.parse(token);
    }

    const isDeflated = token[0] === '1';
    const b64 = token.slice(1).replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));

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

  // 5. Convert any Payload to Standard Transfer Contract
  function normalizeToTransferPayload(rawPayload) {
    if (rawPayload && rawPayload.format === 'adventurers-ledger/roll20' && Array.isArray(rawPayload.operations)) {
      return rawPayload;
    }

    // Single item drop fallback
    if (rawPayload.type === 'drop' || (rawPayload.data && rawPayload.data.Category)) {
      const name = rawPayload.name || rawPayload.data.Name || 'Item';
      const cat = rawPayload.category || rawPayload.data.Category || 'Spells';
      const content = rawPayload.content || rawPayload.data['data-description'] || '';
      const data = rawPayload.data || rawPayload;

      if (cat === 'Spells') {
        return {
          format: 'adventurers-ledger/roll20',
          version: 1,
          character: { name: 'Current Character' },
          label: `Single Spell: ${name}`,
          operations: [
            {
              id: `spell:${norm(name)}`,
              group: 'Spells',
              label: name,
              kind: 'spell',
              name,
              data: {
                Category: 'Spells',
                Name: name,
                Level: data.Level ?? 1,
                School: data.School || 'Evocation',
                'data-description': content,
                ...data
              },
              content
            }
          ],
          warnings: []
        };
      }

      if (cat === 'Features' || cat === 'Traits' || cat === 'Feats') {
        return {
          format: 'adventurers-ledger/roll20',
          version: 1,
          character: { name: 'Current Character' },
          label: `Single Feature: ${name}`,
          operations: [
            {
              id: `trait:${norm(name)}`,
              group: 'Features & Traits',
              label: name,
              kind: 'row',
              section: 'traits',
              nameField: 'name',
              values: {
                name,
                source: cat === 'Feats' ? 'Feat' : 'Class',
                source_type: data.Properties || '',
                description: content
              }
            }
          ],
          warnings: []
        };
      }
    }

    // Legacy full share character object fallback
    const ch = rawPayload.c || rawPayload;
    if (ch && ch.name && ch.abilities) {
      // Basic fallback operations
      const ops = [
        {
          id: 'attr:identity',
          group: 'Base Stats',
          label: `Identity (${ch.name})`,
          kind: 'attributes',
          values: {
            character_name: { current: ch.name || '' },
            race: { current: ch.race || '' },
            background: { current: ch.background || '' },
            alignment: { current: ch.alignment || '' },
            class: { current: ch.classes?.[0]?.name || '' },
            base_level: { current: String(ch.classes?.[0]?.level || 1) }
          }
        },
        {
          id: 'attr:vitals',
          group: 'Base Stats',
          label: `HP & Vitals (${ch.maxHp || 10})`,
          kind: 'attributes',
          values: {
            hp: { current: String(ch.maxHp || 10), max: String(ch.maxHp || 10) },
            hp_temp: { current: String(ch.tempHp || 0) }
          }
        }
      ];

      return {
        format: 'adventurers-ledger/roll20',
        version: 1,
        character: { name: ch.name },
        label: `Character: ${ch.name}`,
        operations: ops,
        warnings: ['Pasted raw share token. For complete spells, attacks, and feats, use the new "Send to Roll20" button in Ledger.']
      };
    }

    throw new Error('Unrecognized transfer payload format');
  }

  // 6. Duplicate & Status Analysis Engine
  function analyzeOperations(targetChar, operations) {
    if (!targetChar || !targetChar.attribs || !targetChar.attribs.models) {
      return operations.map((op) => ({ op, status: 'new', checked: true, note: 'No existing sheet attributes' }));
    }

    const models = targetChar.attribs.models;
    const attrMap = new Map();
    models.forEach((m) => {
      if (!m || !m.collection) return;
      const n = (m.get('name') || '').toLowerCase();
      attrMap.set(n, m);
    });
    return operations.map((op) => {
      // Kind: attributes
      if (op.kind === 'attributes') {
        let allUnchanged = true;
        let diffCount = 0;
        const details = [];

        Object.entries(op.values || {}).forEach(([attrName, patch]) => {
          const m = attrMap.get(attrName.toLowerCase());
          const curVal = m ? String(m.get('current') || '') : '';
          const maxVal = m ? String(m.get('max') || '') : '';
          const targetCur = String(patch.current ?? '');
          const targetMax = patch.max !== undefined ? String(patch.max) : undefined;

          const curMatch = norm(curVal) === norm(targetCur);
          const maxMatch = targetMax === undefined || norm(maxVal) === norm(targetMax);

          if (!curMatch || !maxMatch) {
            allUnchanged = false;
            diffCount++;
            details.push(`${attrName}: ${curVal || 'empty'} → ${targetCur}`);
          }
        });

        if (allUnchanged) {
          return { op, status: 'unchanged', checked: false, note: 'Sheet already has these values' };
        }
        return { op, status: 'update', checked: true, note: `${diffCount} value(s) to update`, details };
      }

      // Kind: row (repeating sections)
      if (op.kind === 'row') {
        const sec = op.section;
        const nameField = op.nameField || 'name';
        const targetName = norm(op.values?.[nameField]);
        if (!targetName) return { op, status: 'new', checked: true, note: 'New row to add' };
        const rowRegex = new RegExp(`^repeating_${sec}_([^_]+)_${nameField}$`, 'i');

        let matchedRowId = null;
        for (let i = 0; i < models.length; i++) {
          const mModel = models[i];
          if (!mModel || !mModel.collection) continue;
          const aName = mModel.get('name') || '';
          const m = aName.match(rowRegex);
          if (m) {
            const val = norm(mModel.get('current'));
            if (val && val === targetName) {
              matchedRowId = m[1];
              break;
            }
          }
        }

        if (matchedRowId) {
          return {
            op,
            status: 'duplicate',
            checked: false, // Default skip duplicates
            existingRowId: matchedRowId,
            note: `Already on sheet (row ${matchedRowId.slice(0, 6)}…). Check to update.`
          };
        }
        return { op, status: 'new', checked: true, note: 'New row to add' };
      }

      // Kind: spell
      if (op.kind === 'spell') {
        const targetName = norm(op.name);
        if (!targetName) return { op, status: 'new', checked: true, note: 'New spell to drop' };
        const spellRegex = /^repeating_spell-([^_]+)_([^_]+)_spellname$/i;

        let matchedRow = null;
        for (let i = 0; i < models.length; i++) {
          const mModel = models[i];
          if (!mModel || !mModel.collection) continue;
          const aName = mModel.get('name') || '';
          const m = aName.match(spellRegex);
          if (m) {
            const val = norm(mModel.get('current'));
            if (val && val === targetName) {
              matchedRow = { level: m[1], rowId: m[2] };
              break;
            }
          }
        }
        if (matchedRow) {
          return {
            op,
            status: 'duplicate',
            checked: false, // Default skip duplicates
            existingRowId: matchedRow.rowId,
            note: `Already in spellbook (${matchedRow.level}). Check to update.`
          };
        }
        return { op, status: 'new', checked: true, note: 'New spell to drop' };
      }

      // Kind: bio
      if (op.kind === 'bio') {
        const m = attrMap.get(op.field.toLowerCase());
        const curText = m ? String(m.get('current') || '') : '';
        const hasText = curText.includes(op.text.trim());

        if (hasText) {
          return { op, status: 'unchanged', checked: false, note: 'Text already present in Bio' };
        }
        return { op, status: 'new', checked: true, note: 'Append narrative to Bio' };
      }

      return { op, status: 'new', checked: true, note: 'Ready to apply' };
    });
  }

  // 7. Execution Engine
  async function applyOperations(char, plan, onProgress) {
    const notifyNames = [];

    function setAttr(name, current, max) {
      let a = char.attribs.find((x) => (x.get('name') || '').toLowerCase() === name.toLowerCase());
      if (!a) a = char.attribs.create({ name });
      const patch = { current: String(current) };
      if (max !== undefined && max !== null) patch.max = String(max);
      a.syncedSave(patch);
      notifyNames.push(name);
      return a;
    }

    let completed = 0;
    const total = plan.length;

    for (let i = 0; i < plan.length; i++) {
      const item = plan[i];
      if (!item.checked) continue;
      const op = item.op;

      onProgress(completed, total, `Applying ${op.label || op.id}...`);

      if (op.kind === 'attributes') {
        Object.entries(op.values || {}).forEach(([attrName, patch]) => {
          setAttr(attrName, patch.current, patch.max);
        });
      } else if (op.kind === 'row') {
        const rowId = item.existingRowId || generateRowID();
        Object.entries(op.values || {}).forEach(([field, val]) => {
          const attrName = `repeating_${op.section}_${rowId}_${field}`;
          setAttr(attrName, val);
        });
      } else if (op.kind === 'spell') {
        // Drop worker trigger
        const data = op.data || { Category: 'Spells', Name: op.name };
        setAttr('drop_name', op.name);
        setAttr('drop_content', op.content || '');
        setAttr('drop_data', typeof data === 'string' ? data : JSON.stringify(data));
        setAttr('drop_category', 'Spells');

        // Notify sheetworker
        if (engine.root.d20?.journal?.notifyWorkersOfAttrChanges) {
          try {
            engine.root.d20.journal.notifyWorkersOfAttrChanges(char.id, ['drop_category'], 'player');
          } catch (_) {}
        }

        // Bounded wait for worker processing
        await new Promise((resolve) => setTimeout(resolve, 350));
      } else if (op.kind === 'bio') {
        const curAttr = char.attribs.find((x) => (x.get('name') || '').toLowerCase() === op.field.toLowerCase());
        const cur = curAttr ? String(curAttr.get('current') || '').trim() : '';
        const combined = cur ? `${cur}\n\n${op.text}` : op.text;
        setAttr(op.field, combined);
      }

      completed++;
    }

    // Trigger Roll20 host worker notification for all changed attributes
    if (notifyNames.length > 0 && engine.root.d20?.journal?.notifyWorkersOfAttrChanges) {
      try {
        engine.root.d20.journal.notifyWorkersOfAttrChanges(char.id, notifyNames, 'player');
      } catch (_) {}
    }

    return completed;
  }

  // 8. Construct HUD Modal Singleton (Draggable, Centered & Responsive)
  const defaultWidth = 430;
  const defaultLeft = Math.max(20, Math.floor((window.innerWidth - defaultWidth) / 2));
  const defaultTop = 75;
  const savedPos = window.__ledgerModalPos || { left: defaultLeft, top: defaultTop };

  let modal = window.__ledgerRoll20Modal;
  if (!modal) {
    modal = document.createElement('div');
    window.__ledgerRoll20Modal = modal;
    document.body.appendChild(modal);
  } else {
    modal.style.display = 'flex';
  }

  modal.style.cssText = [
    'position: fixed',
    `top: ${Math.max(10, Math.min(window.innerHeight - 200, savedPos.top))}px`,
    `left: ${Math.max(10, Math.min(window.innerWidth - defaultWidth - 10, savedPos.left))}px`,
    `width: ${defaultWidth}px`,
    'max-width: calc(100vw - 24px)',
    'max-height: calc(100vh - 40px)',
    'background: #18181f',
    'color: #e8e8e8',
    'border: 2px solid #b89758',
    'border-radius: 12px',
    'padding: 16px 16px 18px 16px',
    'z-index: 9999999',
    'box-shadow: 0 20px 60px rgba(0,0,0,0.95)',
    'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    'display: flex',
    'flex-direction: column',
    'box-sizing: border-box',
    'overflow: visible'
  ].join(';');

  modal.innerHTML = `
    <div id="ledger-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid #333;padding-bottom:10px;cursor:move;user-select:none;">
      <div style="display:flex;align-items:baseline;gap:8px;">
        <span style="color:#d4af37;font-family:Georgia,serif;font-size:16px;font-weight:bold;">Adventurer's Ledger Sync</span>
        <span style="color:#777;font-size:11px;">(drag header to move)</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <button id="ledger-minimize" title="Minimize / Expand" style="width:26px;height:26px;border-radius:6px;background:#24242e;border:1px solid #444;color:#bbb;font-size:15px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0;outline:none!important;box-shadow:none!important;">−</button>
        <button id="ledger-close" title="Close" style="width:26px;height:26px;border-radius:6px;background:#24242e;border:1px solid #444;color:#bbb;font-size:16px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0;outline:none!important;box-shadow:none!important;">✕</button>
      </div>
    </div>
    <div id="ledger-status" style="font-size:12px;color:#aaa;margin-bottom:10px;line-height:1.4;">Checking clipboard...</div>
    
    <div id="ledger-paste-row" style="margin-bottom:10px;display:flex;gap:6px;align-items:stretch;">
      <input id="ledger-paste-input" type="text" placeholder="Or paste transfer JSON / link here" style="flex:1;box-sizing:border-box!important;height:36px!important;padding:6px 10px!important;line-height:22px!important;background:#24242e;color:#fff;border:1px solid #444;border-radius:6px;font-size:12px;outline:none;" />
      <button id="ledger-paste-btn" style="box-sizing:border-box!important;height:36px!important;padding:0 12px!important;background:#333;color:#e8e8e8;border:1px solid #555;border-radius:6px;font-size:12px;cursor:pointer;white-space:nowrap;outline:none;">Load</button>
      <button id="ledger-read-btn" style="box-sizing:border-box!important;height:36px!important;padding:0 12px!important;background:#b89758;color:#111;font-weight:bold;border:none;border-radius:6px;font-size:12px;cursor:pointer;white-space:nowrap;outline:none;">Read Clipboard</button>
    </div>

    <div id="ledger-body" style="display:none;flex:1;min-height:0;flex-direction:column;">
      <label style="font-size:11px;color:#aaa;display:block;margin-bottom:4px;">Target Roll20 Character:</label>
      <select id="ledger-target" style="width:100%!important;box-sizing:border-box!important;height:38px!important;min-height:38px!important;line-height:22px!important;padding:6px 10px!important;background:#24242e;color:#fff;border:1px solid #444;border-radius:6px;margin-bottom:10px;font-size:13px!important;outline:none;cursor:pointer;display:block;"></select>

      <div id="ledger-summary" style="padding:6px 10px;background:#20202a;border-radius:6px;font-size:11px;margin-bottom:8px;line-height:1.4;display:flex;justify-content:space-between;align-items:center;">
        <span id="ledger-summary-text">Ready to analyze</span>
        <div style="display:flex;gap:6px;">
          <button id="ledger-filter-all" style="background:none;border:none;color:#d4af37;cursor:pointer;font-size:11px;padding:0;outline:none;">All</button>
          <span style="color:#555;">|</span>
          <button id="ledger-filter-new" style="background:none;border:none;color:#50fa7b;cursor:pointer;font-size:11px;padding:0;outline:none;">New Only</button>
          <span style="color:#555;">|</span>
          <button id="ledger-filter-none" style="background:none;border:none;color:#888;cursor:pointer;font-size:11px;padding:0;outline:none;">None</button>
        </div>
      </div>

      <div id="ledger-ops-list" style="flex:0 1 auto;overflow-y:auto;background:#141419;border:1px solid #2d2d38;border-radius:6px;padding:4px;margin-bottom:10px;max-height:clamp(100px, 30vh, 220px);"></div>

      <button id="ledger-apply-btn" style="flex-shrink:0;box-sizing:border-box!important;height:42px!important;width:100%!important;padding:0 14px;background:#b89758;border:none;border-radius:6px;color:#111;font-weight:bold;font-size:13px;cursor:pointer;outline:none;margin-top:2px;">Apply Selected to Character Sheet</button>
    </div>
  `;

  modal.querySelector('#ledger-close').onclick = () => { modal.style.display = 'none'; };

  // Draggable Header logic
  const header = modal.querySelector('#ledger-header');
  let isDragging = false;
  let dragX = 0, dragY = 0, origLeft = 0, origTop = 0;

  header.onmousedown = (e) => {
    if (e.target.tagName === 'BUTTON') return;
    isDragging = true;
    dragX = e.clientX;
    dragY = e.clientY;
    const rect = modal.getBoundingClientRect();
    origLeft = rect.left;
    origTop = rect.top;
    modal.style.left = origLeft + 'px';
    modal.style.top = origTop + 'px';
    modal.style.right = 'auto';
    header.style.cursor = 'grabbing';
    e.preventDefault();
  };

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragX;
    const dy = e.clientY - dragY;
    const newLeft = Math.max(10, Math.min(window.innerWidth - modal.offsetWidth - 10, origLeft + dx));
    const newTop = Math.max(10, Math.min(window.innerHeight - modal.offsetHeight - 10, origTop + dy));
    modal.style.left = newLeft + 'px';
    modal.style.top = newTop + 'px';
    window.__ledgerModalPos = { left: newLeft, top: newTop };
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      header.style.cursor = 'move';
    }
  });

  // Minimize toggle
  const minBtn = modal.querySelector('#ledger-minimize');
  let isMinimized = false;
  minBtn.onclick = () => {
    isMinimized = !isMinimized;
    const statusEl = modal.querySelector('#ledger-status');
    const pasteRow = modal.querySelector('#ledger-paste-row');
    const bodyEl = modal.querySelector('#ledger-body');
    if (statusEl) statusEl.style.display = isMinimized ? 'none' : '';
    if (pasteRow) pasteRow.style.display = isMinimized ? 'none' : 'flex';
    if (bodyEl) bodyEl.style.display = isMinimized ? 'none' : (currentTransfer ? 'flex' : 'none');
    minBtn.textContent = isMinimized ? '+' : '−';
  };
  let currentTransfer = null;
  let currentPlan = [];

  function setStatus(html) {
    modal.querySelector('#ledger-status').innerHTML = html;
  }

  // Permission Check: Verify current player controls / has permission to edit this character
  function canCurrentPlayerEdit(charModel) {
    if (!charModel) return false;
    try {
      // Exclude archived characters
      if (charModel.get('archived') === true) return false;

      // Native Roll20 method: returns true if GM or if current player controls
      if (typeof charModel.currentPlayerControls === 'function') {
        return Boolean(charModel.currentPlayerControls());
      }

      // Check if current user is GM
      const isGm = Boolean(engine.root.is_gm || (engine.root.d20 && engine.root.d20.is_gm));
      if (isGm) return true;

      // Fallback check against controlledby attribute
      const controlledBy = String(charModel.get('controlledby') || '')
        .split(',')
        .map((s) => s.trim());
      if (controlledBy.includes('all')) return true;

      const curPlayer = engine.root.currentPlayer || (engine.root.d20 && engine.root.d20.currentPlayer);
      const playerId = curPlayer ? curPlayer.id : null;
      if (playerId && controlledBy.includes(playerId)) return true;

      return false;
    } catch (_) {
      return false;
    }
  }

  function populateCharacterSelect(suggestedName) {
    const select = modal.querySelector('#ledger-target');
    select.innerHTML = '';

    const openDialogId = (engine.root.$ && engine.root.$('.characterdialog[data-characterid]').attr('data-characterid'))
      || (typeof engine.d20 !== 'undefined' && engine.d20.characterId);

    const allChars = engine.Campaign.characters.models || [];
    // Strictly filter to only characters the current player is authorized to edit
    const editableChars = allChars.filter(canCurrentPlayerEdit);

    if (editableChars.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No editable characters found for your account';
      select.appendChild(opt);
      select.disabled = true;
      setStatus('<span style="color:#ffb86c;">⚠️ No characters in this campaign are assigned to your player account to edit.</span>');
      return;
    }

    select.disabled = false;
    editableChars.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.get('name') || 'Unnamed Character';
      if (openDialogId && m.id === openDialogId) opt.selected = true;
      else if (!openDialogId && suggestedName && norm(opt.textContent) === norm(suggestedName)) opt.selected = true;
      select.appendChild(opt);
    });

    select.onchange = () => {
      if (currentTransfer) renderPlan();
    };
  }

  function renderPlan() {
    const select = modal.querySelector('#ledger-target');
    const targetChar = engine.Campaign.characters.get(select.value);
    const applyBtn = modal.querySelector('#ledger-apply-btn');

    if (!targetChar || !canCurrentPlayerEdit(targetChar)) {
      if (applyBtn) applyBtn.disabled = true;
      setStatus('<span style="color:#d76a76;">Permission denied: You do not have permission to edit this character.</span>');
      return;
    }

    currentPlan = analyzeOperations(targetChar, currentTransfer.operations);

    const newCount = currentPlan.filter((p) => p.status === 'new').length;
    const updateCount = currentPlan.filter((p) => p.status === 'update').length;
    const dupCount = currentPlan.filter((p) => p.status === 'duplicate').length;
    const summaryText = modal.querySelector('#ledger-summary-text');
    if (summaryText) {
      summaryText.textContent = `${currentPlan.length} ops (${newCount} new, ${updateCount} updates, ${dupCount} dupes skipped)`;
    }
    const list = modal.querySelector('#ledger-ops-list');
    list.innerHTML = '';
    currentPlan.forEach((item) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:flex-start;gap:8px;padding:6px 8px;border-bottom:1px solid #222;font-size:12px;line-height:1.4;';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = item.checked;
      cb.style.marginTop = '2px';
      cb.onchange = () => { item.checked = cb.checked; };

      const badge = document.createElement('span');
      badge.style.cssText = 'padding:2px 6px;border-radius:4px;font-size:10px;font-weight:bold;text-transform:uppercase;white-space:nowrap;';
      if (item.status === 'new') {
        badge.textContent = 'New';
        badge.style.background = '#1a3824';
        badge.style.color = '#50fa7b';
      } else if (item.status === 'update') {
        badge.textContent = 'Update';
        badge.style.background = '#192b42';
        badge.style.color = '#61afef';
      } else if (item.status === 'duplicate') {
        badge.textContent = 'Skip (Dupe)';
        badge.style.background = '#3d2e1a';
        badge.style.color = '#ffb86c';
      } else {
        badge.textContent = 'Unchanged';
        badge.style.background = '#222';
        badge.style.color = '#888';
      }

      const desc = document.createElement('div');
      desc.style.flex = '1';

      const title = document.createElement('strong');
      title.textContent = item.op.label || item.op.id;
      title.style.color = '#eee';
      desc.appendChild(title);

      const note = document.createElement('div');
      note.textContent = item.note;
      note.style.color = '#888';
      note.style.fontSize = '11px';
      desc.appendChild(note);

      row.appendChild(cb);
      row.appendChild(badge);
      row.appendChild(desc);
      list.appendChild(row);
    });

    modal.querySelector('#ledger-body').style.display = 'flex';
  }

  async function loadData(rawText) {
    try {
      setStatus('Decoding transfer payload...');
      const parsed = await parseSharePayload(rawText);
      currentTransfer = normalizeToTransferPayload(parsed);

      populateCharacterSelect(currentTransfer.character?.name);
      renderPlan();

      setStatus(`✓ Loaded: <strong>${currentTransfer.label || 'Transfer Package'}</strong>`);
    } catch (err) {
      setStatus(`<span style="color:#d76a76;">Error: ${err.message}</span>`);
    }
  }

  modal.querySelector('#ledger-paste-btn').onclick = () => {
    const val = modal.querySelector('#ledger-paste-input').value;
    loadData(val);
  };

  modal.querySelector('#ledger-read-btn').onclick = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        modal.querySelector('#ledger-paste-input').value = text;
        loadData(text);
      } else {
        setStatus('Clipboard is empty. Paste data into the text box.');
      }
    } catch (_) {
      setStatus('Could not auto-read clipboard. Paste into the text box and click Load.');
    }
  };

  modal.querySelector('#ledger-filter-all').onclick = () => {
    currentPlan.forEach((p) => { p.checked = true; });
    modal.querySelectorAll('#ledger-ops-list input[type="checkbox"]').forEach((cb) => { cb.checked = true; });
  };
  modal.querySelector('#ledger-filter-new').onclick = () => {
    currentPlan.forEach((p) => { p.checked = p.status === 'new' || p.status === 'update'; });
    modal.querySelectorAll('#ledger-ops-list input[type="checkbox"]').forEach((cb, i) => {
      cb.checked = currentPlan[i].checked;
    });
  };
  modal.querySelector('#ledger-filter-none').onclick = () => {
    currentPlan.forEach((p) => { p.checked = false; });
    modal.querySelectorAll('#ledger-ops-list input[type="checkbox"]').forEach((cb) => { cb.checked = false; });
  };

  modal.querySelector('#ledger-apply-btn').onclick = async () => {
    const btn = modal.querySelector('#ledger-apply-btn');
    const select = modal.querySelector('#ledger-target');
    const targetChar = engine.Campaign.characters.get(select.value);

    if (!targetChar || !canCurrentPlayerEdit(targetChar)) {
      alert('Permission Denied: You do not have permission to edit this character in Roll20.');
      btn.disabled = true;
      return;
    }

    const countToApply = currentPlan.filter((p) => p.checked).length;
    if (countToApply === 0) {
      alert('No operations selected to apply.');
      return;
    }

    btn.disabled = true;
    btn.style.background = '#444';
    btn.textContent = 'Applying updates...';

    try {
      const applied = await applyOperations(targetChar, currentPlan, (cur, tot, msg) => {
        btn.textContent = `Applying (${cur}/${tot})...`;
        setStatus(`<span style="color:#61afef;">${msg}</span>`);
      });

      btn.textContent = `Applied ${applied} operations ✓`;
      btn.style.background = '#50fa7b';
      btn.style.color = '#111';
      setStatus(`<span style="color:#50fa7b;">✓ Sync complete! Applied ${applied} updates to <strong>${targetChar.get('name') || 'Character'}</strong>.</span>`);

      setTimeout(() => {
        renderPlan();
        btn.disabled = false;
        btn.style.background = '#b89758';
        btn.textContent = 'Apply Selected to Character Sheet';
      }, 2500);
    } catch (err) {
      btn.disabled = false;
      btn.style.background = '#d76a76';
      btn.textContent = 'Error during apply';
      setStatus(`<span style="color:#d76a76;">Error during sync: ${err.message}</span>`);
    }
  };

  // Attempt initial clipboard read on modal open
  (async function () {
    try {
      const text = await navigator.clipboard.readText();
      if (text && (text.includes('adventurers-ledger') || text.includes('#share=') || text.startsWith('{'))) {
        modal.querySelector('#ledger-paste-input').value = text;
        loadData(text);
        return;
      }
    } catch (_) {}
    setStatus('Ready. Paste your Ledger export into the box above or click Read Clipboard.');
  })();
})();
