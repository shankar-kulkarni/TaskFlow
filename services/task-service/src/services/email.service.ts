import nodemailer from 'nodemailer';
import { prisma } from '../prisma';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '25'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    : undefined
});

export class EmailService {
  static async sendEmailVerification(
    email: string,
    displayName: string,
    verificationUrl: string,
    userId: string
  ) {
    const html = `
      <h2>Verify your email</h2>
      <p>Hi ${displayName},</p>
      <p>Click the link below to verify your email:</p>
      <a href="${verificationUrl}">Verify Email</a>
      <p>This link expires in 24 hours.</p>
    `;

    return this.send(email, 'Verify your TaskFlow email', html, 'email_verification', userId);
  }

  static async sendPasswordResetEmail(email: string, displayName: string, resetUrl: string, userId: string) {
    const html = `
      <h2>Reset your password</h2>
      <p>Hi ${displayName},</p>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}">Reset Password</a>
      <p>This link expires in 1 hour.</p>
    `;

    return this.send(email, 'Reset your TaskFlow password', html, 'password_reset', userId);
  }

  static async sendTaskAssignedEmail(
    email: string,
    displayName: string,
    taskTitle: string,
    taskUrl: string,
    userId: string
  ) {
    const html = `
      <h2>You've been assigned a task</h2>
      <p>Hi ${displayName},</p>
      <p>You've been assigned to: <strong>${taskTitle}</strong></p>
      <a href="${taskUrl}">View Task</a>
    `;

    return this.send(email, `Task assigned: ${taskTitle}`, html, 'task_assigned', userId);
  }

  static async sendCommentMentionEmail(
    email: string,
    displayName: string,
    commentAuthor: string,
    taskTitle: string,
    taskUrl: string,
    excerpt: string,
    userId: string
  ) {
    const html = `
      <h2>You were mentioned in a comment</h2>
      <p>Hi ${displayName},</p>
      <p><strong>${commentAuthor}</strong> mentioned you in a comment on: <strong>${taskTitle}</strong></p>
      <blockquote>${excerpt}</blockquote>
      <a href="${taskUrl}">View Comment</a>
    `;

    return this.send(
      email,
      `You were mentioned in: ${taskTitle}`,
      html,
      'comment_mention',
      userId
    );
  }

  private static async send(
    toEmail: string,
    subject: string,
    html: string,
    templateType: string,
    userId: string
  ): Promise<boolean> {
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@taskflow.local',
        to: toEmail,
        subject,
        html
      });

      await prisma.emailLog.create({
        data: {
          userId,
          toEmail,
          subject,
          templateType,
          status: 'sent',
          sentAt: new Date()
        }
      });

      return true;
    } catch (error) {
      console.error('Email send failed:', error);
      await prisma.emailLog.create({
        data: {
          userId,
          toEmail,
          subject,
          templateType,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      return false;
    }
  }
}
