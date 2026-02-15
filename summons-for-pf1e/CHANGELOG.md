# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2024

### Added
- Initial release as a Foundry VTT module
- Converted from macro to proper module structure
- Module settings for all configuration options
- Integration with Foundry v13 core world time system
- Header button on character sheets for easy access
- API exposure for macro usage
- Comprehensive duration tracking system
- Automatic cleanup and expiration handling

### Changed
- Replaced Simple Calendar dependency with core `game.time.worldTime`
- Reorganized code into logical modules:
  - `config.js` - Configuration constants
  - `settings.js` - Module settings registration
  - `summon-dialog.js` - Dialog UI class
  - `summon-manager.js` - Core summoning logic
  - `expiration-tracker.js` - Duration tracking and cleanup
  - `main.js` - Module initialization and API
- Improved error handling and logging
- Enhanced combat integration with better token tracking

### Fixed
- Token registration timing issues in combat
- Expiration tracking edge cases
- Combatant-to-token association in PF1e system

### Technical Details
- Uses ES6 modules for better code organization
- Proper Foundry VTT module structure with manifest
- Localization support (English included)
- CSS styling for dialogs and chat cards
- Hook-based event system for clean integration

## Development Notes

### Converting from Macro
The original macro functionality has been preserved while gaining:
- Persistent settings across sessions
- Better integration with Foundry's module system
- Easier maintenance and updates
- User-friendly configuration interface
- API for other modules and macros to use

### Future Plans
- Additional template support
- Enhanced buff options
- Summoning presets
- Multi-language support
- Integration with additional compendiums
