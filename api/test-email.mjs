import nodemailer from 'nodemailer';

async function test() {
  const transporter = nodemailer.createTransport({
    host: 'mail.suncatcher.com.mx',
    port: 465,
    secure: true,
    auth: {
      user: 'ventas@suncatcher.com.mx',
      pass: '**xmiswebs**'
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  try {
    const info = await transporter.sendMail({
      from: '"Test" <ventas@suncatcher.com.mx>',
      to: 'ventas@suncatcher.com.mx', // send to itself
      subject: 'Test email from node',
      text: 'Hello world'
    });
    console.log('Success:', info.messageId);
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
