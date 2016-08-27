/* @flow */

import { CompositeDisposable, Emitter } from 'sb-event-kit'
import debounce from 'sb-debounce'
import disposableEvent from 'disposable-event'
import { calculateDecorations } from './helpers'
import type { LinterMessage, MessagesPatch, TreeViewHighlight } from '../types'

export default class TreeView {
  emitter: Emitter;
  messages: Array<LinterMessage>;
  decorations: Object;
  subscriptions: CompositeDisposable;
  decorateOnTreeView: 'Files and Directories' | 'Files' | 'None';

  constructor() {
    this.emitter = new Emitter()
    this.messages = []
    this.decorations = {}
    this.subscriptions = new CompositeDisposable()

    this.subscriptions.add(this.emitter)
    this.subscriptions.add(atom.config.observe('linter-ui-default.decorateOnTreeView', decorateOnTreeView => {
      if (typeof this.decorateOnTreeView === 'undefined') {
        this.decorateOnTreeView = decorateOnTreeView
      } else if (decorateOnTreeView === 'None') {
        this.render()
        this.decorateOnTreeView = decorateOnTreeView
      } else {
        const messages = this.messages
        this.render()
        this.decorateOnTreeView = decorateOnTreeView
        this.render(messages)
      }
    }))

    setTimeout(() => {
      const element = TreeView.getElement()
      if (this.subscriptions.disposed || !element) {
        return
      }
      this.subscriptions.add(disposableEvent(element, 'click', debounce(() => {
        this.render(this.messages)
      })))
    }, 1000)
  }
  apply(difference: MessagesPatch) {
    this.messages = difference.messages
    const element = TreeView.getElement()
    const decorateOnTreeView = this.decorateOnTreeView
    if (!element || decorateOnTreeView === 'None') {
      return
    }

    this.applyDecorations(calculateDecorations(decorateOnTreeView, difference.messages))
  }
  render(messages: Array<LinterMessage> = []) {
    this.apply({ added: [], messages: [], removed: this.messages })
    if (messages.length) {
      this.apply({ added: messages, messages, removed: [] })
    }
  }
  applyDecorations(decorations: Object) {
    const treeViewElement = TreeView.getElement()
    if (!treeViewElement) {
      return
    }
    for (const filePath in this.decorations) {
      if (!{}.hasOwnProperty.call(this.decorations, filePath)) {
        continue
      }
      if (!decorations[filePath]) {
        // Removed
        const element = TreeView.getElementByPath(treeViewElement, filePath)
        if (element) {
          this.removeDecoration(element)
        }
      }
    }
    for (const filePath in decorations) {
      if (!{}.hasOwnProperty.call(decorations, filePath)) {
        continue
      }
      const element = TreeView.getElementByPath(treeViewElement, filePath)
      if (!element) {
        continue
      }
      this.handleDecoration(element, this.decorations[filePath], decorations[filePath])
    }
    this.decorations = decorations
  }
  handleDecoration(element: HTMLElement, update: boolean = false, highlights: TreeViewHighlight) {
    let decoration
    if (update) {
      decoration = element.querySelector('linter-decoration')
    }
    if (decoration) {
      decoration.className = ''
    } else {
      decoration = document.createElement('linter-decoration')
      element.appendChild(decoration)
    }
    if (highlights.error) {
      decoration.classList.add('linter-error')
    } else if (highlights.warning) {
      decoration.classList.add('linter-warning')
    } else if (highlights.info) {
      decoration.classList.add('linter-info')
    }
  }
  removeDecoration(element: HTMLElement) {
    const decoration = element.querySelector('linter-decoration')
    if (decoration) {
      decoration.remove()
    }
  }
  dispose() {
    this.subscriptions.dispose()
  }
  static getElement() {
    return document.querySelector('.tree-view')
  }
  static getElementByPath(parent: HTMLElement, filePath): ?HTMLElement {
    return parent.querySelector(`[data-path=${CSS.escape(filePath)}]`)
  }
}
