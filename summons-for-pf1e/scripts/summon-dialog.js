/**
 * Dialog for summoning monsters
 */
import { getConfig } from './settings.js';
import { SummonManager } from './summon-manager.js';

export class SummonDialog extends Dialog {
    constructor(summonerActor, summonerToken, options = {}) {
        const config = getConfig();
        
        const dialogData = {
            title: "Summon Monster",
            content: SummonDialog._getContent(summonerActor, summonerToken, config),
            buttons: {
                use: {
                    icon: '<i class="fas fa-dice-d20"></i>',
                    label: "Summon",
                    callback: (html) => SummonDialog._onSummon(html, summonerActor, summonerToken, config)
                }
            },
            default: "use",
            render: (html) => SummonDialog._onRender(html, config)
        };

        super(dialogData, options);
    }

    static _getContent(summonerActor, summonerToken, config) {
        // Build pack options
        const packOptions = `<option value=""></option>` + game.packs
            .filter(p => p.documentName === "Actor" && 
                    config.packSource.includes(p.metadata.packageName) && 
                    !config.ignoreCompendiums?.includes(p.metadata.name) && 
                    p.visible)
            .map(p => `<option value="${p.collection}">${p.title}</option>`)
            .join('');

        // Build spellbook options
        const spellbooks = summonerActor.system?.attributes?.spells?.spellbooks || {};
        const spellbookKeys = Object.keys(spellbooks);
        const schoolConCL = summonerActor.system?.attributes?.spells?.school?.con?.cl;

        const spellbookOptions = spellbookKeys
            .map(key => {
                if (typeof key !== 'string') return '';
                const value = spellbooks[key];
                if (!value?.inUse) return '';
                let className = (typeof value.class === 'string') ? value.class : 
                               (value.class && typeof value.class.name === 'string' ? value.class.name : undefined);
                if (!className) return '';
                
                let classNameCap = className.charAt(0).toUpperCase() + className.slice(1);
                let cl = (typeof value.cl?.total === 'number') ? value.cl.total : value.cl || 1;
                let conjBonus = (typeof schoolConCL === 'number' && schoolConCL > 0) ? schoolConCL : 0;
                let totalCL = cl + conjBonus;
                let bonusText = conjBonus ? ` (+${conjBonus} Conj)` : '';
                return `<option value="${String(key)}">${classNameCap} (CL ${totalCL}${bonusText})</option>`;
            })
            .filter(opt => typeof opt === 'string' && opt.length > 0)
            .join('');

        const ownerCheck = (game.user.isGM && summonerActor.hasPlayerOwner) 
            ? `<div class="form-group"><label>Give Ownership to ${summonerActor.name}'s Owners:</label><input type="checkbox" id="ownerCheck"></div>`
            : "";

        return `
            <form class="flexcol">
                <div class="form-group">
                    <label>Summoner:</label>
                    <p>${summonerActor.name}</p>
                </div>
                <div class="form-group">
                    <label>Spellbook:</label>
                    <select id="classSelect">${spellbookOptions}</select>
                </div>
                <div class="form-group">
                    <label>CL Override:</label>
                    <input type="number" id="clOverride" placeholder="CL (e.g. for scrolls)">
                </div>
                <div class="form-group">
                    <label>Summon From:</label>
                    <select id="sourceSelect">${packOptions}</select>
                </div>
                <div class="form-group">
                    <label>Summon:</label>
                    <select id="monsterSelect"></select>
                </div>
                <div class="form-group">
                    <label>Template:</label>
                    <select id="template">
                        <option value="Celestial">Celestial</option>
                        <option value="Fiendish">Fiendish</option>
                        <option value="Entropic">Entropic</option>
                        <option value="Resolute">Resolute</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Number to Summon:</label>
                    <input type="text" id="summonCount" placeholder="e.g. 1, 1d4+1">
                </div>
                ${config.enableAugmentSummoning ? `
                <div class="form-group">
                    <label>Augment Summoning:</label>
                    <input type="checkbox" id="augmentCheck" checked>
                </div>` : ""}
                ${config.enableExtendMetamagic ? `
                <div class="form-group">
                    <label>Extend (Metamagic):</label>
                    <input type="checkbox" id="extendCheck">
                </div>` : ""}
                ${config.enableReachMetamagic ? `
                <div class="form-group">
                    <label>Reach (Metamagic):</label>
                    <input type="checkbox" id="reachCheck">
                </div>` : ""}
                ${config.enableConjuredArmor ? `
                <div class="form-group">
                    <label>Conjured Armor:</label>
                    <input type="checkbox" id="conjuredArmorCheck">
                </div>` : ""}
                ${config.enableHarrowedSummoning ? `
                <fieldset style="margin-top:1em; border:1px solid #888; border-radius:4px; padding:0.5em;">
                    <legend style="font-weight:bold;">Harrowed Summoning</legend>
                    <div class="form-group">
                        <label>Suit 1:</label>
                        <select id="harrow1">
                            <option value=""></option>
                            <option value="str">Hammers</option>
                            <option value="dex">Keys</option>
                            <option value="con">Shields</option>
                            <option value="int">Books</option>
                            <option value="wis">Stars</option>
                            <option value="cha">Crowns</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Suit 2:</label>
                        <select id="harrow2">
                            <option value=""></option>
                            <option value="str">Hammers</option>
                            <option value="dex">Keys</option>
                            <option value="con">Shields</option>
                            <option value="int">Books</option>
                            <option value="wis">Stars</option>
                            <option value="cha">Crowns</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Alignment Match:</label>
                        <select id="harrowMatch">
                            <option value=1></option>
                            <option value=2>Double Duration</option>
                            <option value=.5>Half Duration</option>
                        </select>
                    </div>
                </fieldset>` : ""}
                ${ownerCheck}
            </form>
        `;
    }

    static _onRender(html, config) {
        html.find('#sourceSelect').change((event) => SummonDialog._populateMonster(html, event));
        
        function updateTemplateState() {
            const monsterSelect = html.find("#monsterSelect");
            const templateSelect = html.find("#template");
            const selectedOption = monsterSelect.find("option:selected");
            const selectedName = selectedOption.text() || "";
            if (!selectedName.trim().endsWith("*")) {
                templateSelect.prop("disabled", true).css("opacity", 0.5);
            } else {
                templateSelect.prop("disabled", false).css("opacity", 1);
            }
        }
        
        html.find("#monsterSelect").change(updateTemplateState);
        updateTemplateState();
    }

    static async _populateMonster(html, event) {
        let selectedPack = event.target.value;
        let monsterSelect = html.find("#monsterSelect")[0];
        let monsterOptions = "";
        
        if (selectedPack) {
            let monsterList = await game.packs.get(selectedPack).getIndex();
            monsterOptions = monsterList.contents
                .sort((a, b) => a.name > b.name ? 1 : -1)
                .map(p => `<option value="${p._id}">${p.name}</option>`)
                .join('');
        }
        
        monsterSelect.innerHTML = monsterOptions;
        
        html.find("#monsterSelect").off("change").on("change", function() {
            const templateSelect = html.find("#template");
            const selectedOption = $(this).find("option:selected");
            const selectedName = selectedOption.text() || "";
            if (!selectedName.trim().endsWith("*")) {
                templateSelect.prop("disabled", true).css("opacity", 0.5);
            } else {
                templateSelect.prop("disabled", false).css("opacity", 1);
            }
        }).trigger("change");
    }

    static async _onSummon(html, summonerActor, summonerToken, config) {
        const manager = new SummonManager(summonerActor, summonerToken, config);
        await manager.importMonster(html);
    }
}
