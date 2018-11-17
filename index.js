const TelegramBot = require('node-telegram-bot-api')

const ROOT_COMMAND = '/'

class Bot {

  constructor(token, commands, options = {}) {
    const bot = new TelegramBot(token, Object.assign({ polling: true }, options))

    bot.on('message', (msg) => {
      if (typeof commands[msg.text] === 'function') {
        const message = new Message(bot, msg)
        commands[msg.text](message)
      
      } else if (typeof commands[ROOT_COMMAND] === 'function') {
        const message = new Message(bot, msg)
        commands[ROOT_COMMAND](message)
      }
    })

    bot.on('callback_query', (msg) => {
      const data = JSON.parse(msg.data)

      if (typeof data.alert === 'string') {
        bot.answerCallbackQuery(msg.id, { text: data.alert })
      } else {
        bot.answerCallbackQuery(msg.id)
      }

      if (typeof commands[data['@']] === 'function') {
        const message = new Message(bot, msg.message, data)
        commands[data['@']](message)
      }
    })

    this.bot = bot
  }

  sendMessage(chatId, message, options) {
    this.bot.sendMessage(chatId, message, options)
  }

}

class Message {

  constructor(bot, msg, data = {}) {
    this.bot   = bot
    this.msg   = msg
    this.text  = msg.text
    this.data  = data
    this.media = {}

    const mediaTypes = ['document', 'photo', 'voice', 'audio']
    
    mediaTypes.forEach((mediaType) => {
      if (msg[mediaType]) {
        this.media[mediaType] = msg[mediaType]
      }
    })
  }

  send(message, options = {}) {
    let editMessageId = options.edit
    const onReply = options.on_reply

    if (Object.keys(options).length > 0) {
      let markup = {}

      // Keyboard
      if (options.buttons) {
        markup.inline_keyboard = options.buttons.map((buttonsRow) => {
          return buttonsRow.map((button) => {
            const data = Object.assign({ 'action': options.action }, button.data)

            if (data.hasOwnProperty('url')) {
              return {
                'text': button.text,
                'url': data.url
              }
            }

            if (data.hasOwnProperty('action')) {
              data['@'] = data['action']
              delete data['action']
            }

            return {
              'text': button.text,
              'callback_data': JSON.stringify(data)
            }
          })
        })
      }

      // ForceReply
      if (options.force_reply) {
        markup.force_reply = true
      }

      if (options.target === 'self') {
        editMessageId = this.msg.message_id
      }

      options = { 'reply_markup': markup }
    }

    // Default parse mode
    options.parse_mode = 'markdown'

    if (editMessageId) {
      Object.assign(options, { 'chat_id': this.msg.chat.id, 'message_id': editMessageId })
      
      return this.bot.editMessageText(message, options).then((msg) => {
        return msg.message_id
      })
    
    } else {
      return this.bot.sendMessage(this.msg.chat.id, message, options).then((msg) => {
        if (typeof onReply === 'function') {
          const id = this.bot.onReplyToMessage(msg.chat.id, msg.message_id, (replyMessage) => {
            const message = new Message(this.bot, replyMessage, {})
            onReply(message)

            this.bot.removeReplyListener(id)
          })
        }

        return msg.message_id
      })
    }
  }

  self(message, options = {}) {
    options.target = 'self'
    return this.send(message, options)
  }

  update(messageId, message, options = {}) {
    options.edit = messageId
    return this.send(message, options)
  }

  button(text, data = {}) {
    return { 'text': text, 'data': data }
  }

  btn(text, data = {}) {
    return this.button(text, data)
  }

  buttons(buttons, limit = 10) {
    const r = []

    for (let i = 0, len = buttons.length; i < len; i+= limit) {
      r.push(buttons.slice(i, i + limit))
    }

    return r
  }

  buttonsCol(buttons) {
    return this.buttons(buttons, 1)
  }
}

module.exports = Bot