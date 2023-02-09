const forward = "http://127.0.0.1:7666/wx"  // 转发地址
const nickname = "风之高兴"   // 昵称

const { FileBox } = require("file-box")
const { WechatyBuilder} = require("wechaty")
const axios = require("axios")
const qrcode_terminal = require("qrcode-terminal") // 二维码生成

const wechaty = WechatyBuilder.build({  //https://wechaty.github.io/wechaty/
  puppetOptions: {
    uos: true,  // 开启uos协议 https://wechaty.js.org/2022/07/26/free-uos-ui/
  },
  puppet: "wechaty-puppet-wechat"
});
const res_image_regex = /(?<=\[image=).*?(?=\])/g
let last_image_path = "" // 最后一张图像路径

wechaty
  .on("scan", (qrcode, status) => {
    qrcode_terminal.generate(qrcode, {
      small: true
    }) // show qrcode on console
    console.log(`Scan QR Code to login: ${status}\nhttps://wechaty.js.org/qrcode/${encodeURIComponent(qrcode)}`)
    // if (status === ScanStatus.Confirmed)
  })
  .on("login", (user) => {
    console.log(`${user.name()} 已登录`)
  })
  .on("message", async (message) => {
    if (message.self()) return;
    const contact = message.talker()      // 内容对象
    const room = message.room()           // 房间对象
    const type = message.type()           // 消息类型
    if (type === 6) { // 图片
      const fileBox = await message.toFileBox()
      const suffix = fileBox.name.substr(fileBox.name.lastIndexOf("."))
      last_image_path = `tmp/${new Date().getTime()}_${contact.payload.name}${suffix}`
      const _last_image_path = last_image_path
      await fileBox.toFile(_last_image_path)
    } else if (type === 7) { // 文本
      let text = message.text()
      if (room && text.indexOf(`@${nickname}`) === -1) return; // 在群里被at才回答
      console.log(`type:${type},room:${room},name:${contact.payload.name}\ntext:${text}`)
      try{
        if (last_image_path && text.indexOf("[图参]") !== -1){
          text = text.replace(/\[图参\]/g,"")
          let image_base64 = await FileBox.fromFile(last_image_path).toBase64()
          text += `[base64=${image_base64}]`
        }
        const res = await axios.post(forward, {
          "payload": contact.payload,
          room, type, text
        },{
          headers:{
            'Content-Type': 'application/json;charset=UTF-8'
          },
          timeout: 60_000
        })
        let data = res.data
        console.log(`data:${data}`)
        if (!data) return;
        let images = data.match(res_image_regex)
        if (images && images.length){
          message.say(FileBox.fromUrl(images[0]))
          data = data.replace(res_image_regex, '').replace('[image=]', '')
        }
        message.say(data)
      }catch (e){
        console.error(e)
      }
    }
  })
  .on("logout", (user) => {
    console.log(`${user.name()} 已退出`)
  })
  .on('error', (error) => {
    console.error(error)
  });
wechaty.start();
