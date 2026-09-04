import {db} from '@/lib/prisma/db';
import {z} from 'zod';
import {withTransaction} from '@/lib/services/postgres_client';
import {AppError, commonErrorHandler} from '@/lib/services/error_service';

const salaryParamsSchema = z.object({
  salarieId: z.uuid(),
});

const transactionBodySchema = z.object({
  amount: z.number().positive(),
  status: z.enum(['REFUSER', 'VALIDER']),
  type: z.enum(['PAYMENT', 'REFUND', 'TOPUP']),
});

export async function GET(request: Request, { params }: { params: Promise<{ salarieId: string }> })
{   
    try {
        const { salarieId } = await salaryParamsSchema.parseAsync(await params).catch((error) => {
            console.error('Invalid parameters', JSON.stringify(error));
            throw new AppError('Invalid parameters', 400);
        });
        const transactions = await db.orm.public.Transaction.where({ userId: salarieId }).orderBy((u) => u.createdAt.desc()).all();
        if (!transactions) {
            throw new AppError('No transactions found for this salarie', 404);
        }
        return Response.json({ transactions }, { status: 200 });
    } catch (error) {
        console.error('Error fetching salary transactions', JSON.stringify(error));
        const {message, statusCode} = commonErrorHandler(error);
        return Response.json({ error: message }, { status: statusCode });
    }
}

export async function POST(request: Request, { params }: { params: Promise<{ salarieId: string }> })
{   
    try {
        const { salarieId } = await salaryParamsSchema.parseAsync(await params).catch((error) => {
            console.error('Invalid parameters', JSON.stringify(error));
            throw new AppError('Invalid parameters', 400);
        });

        const requestBody = await request.json();

        await transactionBodySchema.parseAsync(requestBody).catch((error) => {
            console.error('Invalid request body', JSON.stringify(error));
            throw new AppError('Invalid request body', 400);
        });

        await withTransaction(async (client) => {
            const rows = await client.query("SELECT balance FROM users WHERE id = $1 FOR UPDATE", [salarieId]);

            if (rows.rowCount === 0) {
                throw new AppError('Salarie not found', 404);
            }

            if (requestBody.status !== "REFUSER") {
                const currentBalance = rows.rows[0].balance;
                const newBalance = requestBody.type === "PAYMENT" ? currentBalance - requestBody.amount : currentBalance + requestBody.amount;
    
                if (newBalance < 0) {
                    throw new AppError('Insufficient balance', 400);
                }
                await client.query("UPDATE users SET balance = $1 WHERE id = $2", [newBalance, salarieId]);
            }
        });
        const insertResult = await db.orm.public.Transaction.create({
            userId: salarieId,
            amount: requestBody.amount,
            status: requestBody.status,
            type: requestBody.type,
        });
        if (!insertResult) {
            throw new AppError('Failed to create transaction', 500);
        }
        return Response.json({ message: 'Transaction created successfully' }, { status: 201 });
    } catch (error) {
        console.error('Error creating salary transaction', JSON.stringify(error));
        const {message, statusCode} = commonErrorHandler(error);
        return Response.json({ error: message }, { status: statusCode });
    }
}
