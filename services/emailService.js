const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Interview invitation email
async function sendInterviewInvitation({
  candidateName,
  candidateEmail,
  position,
  interviewLink,
}) {
  const mailOptions = {
    from: `"DeceptionAI" <${process.env.EMAIL_USER}>`,

    to: candidateEmail,

    subject: 'Your AI Interview Invitation',

    html: `
      <!DOCTYPE html>

      <html>
        <head>
          <meta charset="UTF-8" />

          <title>
            AI Interview Invitation
          </title>
        </head>

        <body
          style="
            margin:0;
            padding:0;
            background:#0b1120;
            font-family:Arial,sans-serif;
          "
        >

          <div
            style="
              max-width:600px;
              margin:40px auto;
              background:#111827;
              border:1px solid #263244;
              border-radius:12px;
              padding:30px;
              color:#fff;
            "
          >

            <h1
              style="
                margin:0 0 10px;
                font-size:24px;
              "
            >
              Deception
              <span style="color:#3b82f6;">
                AI
              </span>
            </h1>

            <p
              style="
                color:#9ca3af;
                margin-bottom:25px;
              "
            >
              AI Interview Assessment Platform
            </p>

            <h2 style="font-size:20px;">
              Hello ${candidateName},
            </h2>

            <p
              style="
                color:#d1d5db;
                line-height:1.6;
              "
            >
              You have been invited to complete
              an online AI-powered interview.
            </p>

            <div
              style="
                background:#0b1120;
                border:1px solid #263244;
                border-radius:8px;
                padding:18px;
                margin:25px 0;
              "
            >

              <p style="margin:8px 0;">
                <strong>Position:</strong>
                ${position}
              </p>

              <p style="margin:8px 0;">
                <strong>Email:</strong>
                ${candidateEmail}
              </p>

            </div>

            <a
              href="${interviewLink}"
              style="
                display:inline-block;
                background:#2563eb;
                color:#ffffff;
                text-decoration:none;
                padding:13px 25px;
                border-radius:8px;
                font-weight:bold;
              "
            >
              Start Interview
            </a>

            <p
              style="
                color:#9ca3af;
                font-size:13px;
                margin-top:25px;
                line-height:1.6;
              "
            >
              When you open the interview link,
              enter your email address.
              A verification code will be sent
              to your email before you begin
              the interview.
            </p>

            <hr
              style="
                border:0;
                border-top:1px solid #263244;
                margin:25px 0;
              "
            />

            <p
              style="
                color:#6b7280;
                font-size:12px;
              "
            >
              This is an automated email from
              DeceptionAI.
            </p>

          </div>

        </body>
      </html>
    `,
  };

  return transporter.sendMail(mailOptions);
}


// Verification code email
async function sendVerificationCodeEmail({
  candidateName,
  candidateEmail,
  verificationCode,
}) {
  const mailOptions = {
    from: `"DeceptionAI" <${process.env.EMAIL_USER}>`,

    to: candidateEmail,

    subject: 'Your Interview Verification Code',

    html: `
      <!DOCTYPE html>

      <html>
        <head>
          <meta charset="UTF-8" />

          <title>
            Interview Verification Code
          </title>
        </head>

        <body
          style="
            margin:0;
            padding:0;
            background:#0b1120;
            font-family:Arial,sans-serif;
          "
        >

          <div
            style="
              max-width:600px;
              margin:40px auto;
              background:#111827;
              border:1px solid #263244;
              border-radius:12px;
              padding:30px;
              color:#fff;
              text-align:center;
            "
          >

            <h1
              style="
                margin:0 0 10px;
                font-size:24px;
              "
            >
              Deception
              <span style="color:#3b82f6;">
                AI
              </span>
            </h1>

            <p
              style="
                color:#9ca3af;
                margin-bottom:25px;
              "
            >
              Interview Verification
            </p>

            <h2>
              Hello ${candidateName},
            </h2>

            <p
              style="
                color:#d1d5db;
                line-height:1.6;
              "
            >
              Your verification code is:
            </p>

            <div
              style="
                background:#0b1120;
                border:1px solid #263244;
                border-radius:10px;
                padding:20px;
                margin:25px 0;
              "
            >

              <span
                style="
                  font-size:32px;
                  font-weight:bold;
                  letter-spacing:8px;
                  color:#38bdf8;
                "
              >
                ${verificationCode}
              </span>

            </div>

            <p
              style="
                color:#9ca3af;
                font-size:14px;
              "
            >
              This code will expire in
              <strong>10 minutes</strong>.
            </p>

            <p
              style="
                color:#6b7280;
                font-size:12px;
                margin-top:25px;
              "
            >
              If you did not request this code,
              you can safely ignore this email.
            </p>

          </div>

        </body>
      </html>
    `,
  };

  return transporter.sendMail(mailOptions);
}


module.exports = {
  sendInterviewInvitation,
  sendVerificationCodeEmail,
};