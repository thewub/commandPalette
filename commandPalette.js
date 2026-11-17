$( document ).ready( function() {

	let commandItems, languageItems, sectionItems;
	const languagePrefix = '@';
	const sectionPrefix = '#';

	let generateMenuItems = function() {

		commandItems = [];
		languageItems = [];
		sectionItems = [];

		let links = document.querySelectorAll( '.vector-menu-content a' );
		links.forEach( link => {
		
			// TODO: add appearance menu
			let item = {
				label: link.textContent.trim(),
				description: link.getAttribute('title'),
				value: link,
				priority: 0
			};

			if ( commandItems.some( i => i.label === item.label ) ) {
				// skip duplicates (e.g. Watch in the page actions and in the page menu)
				return;
			}

			if ( link.parentElement.classList.contains( 'selected' ) ) {
				// skip already selected tabs
				return;
			}

			if ( link.closest( '.vector-page-toolbar, #left-navigation, #right-navigation' ) ) {
				item.priority = 1; // page actions should be higher priority
			}
			
			// Twinkle menu
			if ( link.closest( '#p-twinkle' ) ) {
				item.supportingText = '(Twinkle)';
			}

			if ( link.parentElement.classList.contains( 'interlanguage-link' ) ) {
				languageItems.push( item );
			} else {
				commandItems.push( item );
			}
		} );

		let helpLink = document.querySelector( 'a.mw-helplink' );
		if ( helpLink ) {
			let item = {
				label: helpLink.textContent.trim(),
				description: 'Help about this page',
				value: helpLink,
				priority: 1
			};
			commandItems.push( item );
		}

		commandItems.sort( ( a, b ) => b.priority - a.priority ); // sort by priority

		
		let sectionLinks = document.querySelectorAll( '.vector-toc-contents a, #toc a' );
		sectionLinks.forEach( link => {
			let item = {
				label: link.textContent.trim(),
				value: link
			};

			// metadata from discussiontools
			if ( mw.dt ) {
				try {
					let sectionId = link.getAttribute( 'href' ).slice( 1 ); // remove the leading #
					let headingEl = document.getElementById( sectionId );
					let metadataEl = headingEl.parentElement.querySelector( '.ext-discussiontools-init-section-bar' );
					let metadata = [
						metadataEl.querySelector( '.ext-discussiontools-init-section-timestampLabel' )?.textContent.trim(),
						metadataEl.querySelector( '.ext-discussiontools-init-section-commentCountLabel' )?.textContent.trim(),
						metadataEl.querySelector( '.ext-discussiontools-init-section-authorCountLabel' )?.textContent.trim()
					];
					item.description = metadata.join( ' · ' );
				} catch ( e ) {
					// couldn't find metadata, not a big deal
				}
			}

			// Maybe add: getting first bit of content ?
			// document.querySelector('.mw-heading ~ p').textContent.substring(0, 100);

			sectionItems.push( item );
		} );

	}

	mw.loader.using( '@wikimedia/codex' ).then( function( require ) {
		const Vue = require( 'vue' );
		const Codex = require( '@wikimedia/codex' );
		const mountPoint = document.body.appendChild( document.createElement( 'div' ) );
		
		Vue.createMwApp( {
			// TODO: remove the hacky inline styles and use CSS instead
			template: `
				<cdx-dialog class="command-palette-dialog"
					style="margin-top: -30vh; max-width: 42rem;"
					v-model:open="showDialog"
					title="Command palette"
					:subtitle="dialogSubtitle"
					:use-close-button="true"
					:primary-action="primaryAction"
					@default="open = false"
				>
					<cdx-lookup
						v-model:selected="selection"
						:menu-items="menuItems"
						:menu-config="menuConfig"
						aria-label="Command palette"
						@input="onInput"
						@update:selected="selectValue"
						@keydown.enter="selectFirst"
					>
						<template #no-results>
							No results found.
						</template>
					</cdx-lookup>
				</cdx-dialog>
			`,
			data: function() {
				return {
					showDialog: false,
					dialogSubtitle: `${languagePrefix} for languages, ${sectionPrefix} for sections`,
					menuItems: commandItems,
					menuConfig: {
						boldLabel: true
					}
				};
			},
			methods: {
				selectFirst: function( event ) {
					// Bail out if the user has already highlighted something —
					// the Lookup's own Enter handler will commit it.
					const activeId = event.target.getAttribute( 'aria-activedescendant' );
					if ( activeId ) return;

					// if the user presses Enter without selecting an item, select the first item in the list
					if ( this.menuItems.length > 0 ) {
						console.log( 'Enter pressed, selecting first item:', this.menuItems[0] );
						this.selectValue( this.menuItems[0].value );
					}
				},
				onInput: function ( value ) {
					// TODO: clean up the filtering logic
					// TODO: can we highlight the first item?
					if ( value ) {
						let searchValue = value.toLowerCase();
						if ( value.startsWith( languagePrefix ) ) {
							searchValue = searchValue.slice( 1 );
							this.menuItems = languageItems.filter(
								( item ) => {
									return item.label.toLowerCase().includes(searchValue ) || item.description?.toLowerCase().includes( searchValue );
								}
							);
						} else if ( value.startsWith( sectionPrefix ) ) {
							searchValue = searchValue.slice( 1 );
							this.menuItems = sectionItems.filter(
								( item ) => {
									return item.label.toLowerCase().includes( searchValue );
								}
							);
						} else {
							let filteredCommands = [];
							commandItems.forEach( item => {
								if ( item.label.toLowerCase().includes( searchValue ) )  {
									filteredCommands.push( item );
								}
							} );
							commandItems.forEach( item => {
								if ( item.description?.toLowerCase().includes( searchValue ) ) {
									// if the description matches but the label doesn't, add it to the bottom of the list
									if ( !filteredCommands.includes( item ) ) {
										filteredCommands.push( item );
									}
								}
							} );
							commandItems.forEach( item => {
								if ( item.supportingText?.toLowerCase().includes( searchValue ) ) {
									// if the supporting text matches but the label doesn't, add it to the bottom of the list
									if ( !filteredCommands.includes( item ) ) {
										filteredCommands.push( item );
									}
								}
							} );
							this.menuItems = filteredCommands;
						}
					} else {
						this.menuItems = commandItems;
					}
				},
				selectValue: function ( value ) {
					if ( value ) {
						
						// Special tracking for Donate link since I'm curious :)
						if ( value.href.startsWith( 'https://donate.wikimedia.org/' ) ) {
							value.href += '&wmf_key=commandPalette';
						}

						this.showDialog = false;
						console.log( value );
						value.click();
					}
				},
				showCommandPalette: function() {
					generateMenuItems();
					this.inputValue = '';
					this.menuItems = commandItems;
					this.showDialog = true;
				}
			},
			mounted() {
				window.addEventListener('keydown', (e) => {
					// make these work with Ctrl for Windows?

					// Cmd + K
					if ( ( e.metaKey || e.ctrlKey ) && e.key === 'k' ) {
						this.showCommandPalette();
					}

					// Cmd + Shift + P	
					if ( ( e.metaKey || e.ctrlKey ) && e.shiftKey && e.key === 'p' ) {
						this.showCommandPalette();
					}
				});
			}
		} )
		.component( 'cdx-dialog', Codex.CdxDialog )
		.component( 'cdx-lookup', Codex.CdxLookup )
		.mount( mountPoint );
	} );

} );
