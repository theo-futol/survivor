// import {db} from '@/lib/prisma/db';
// import {z} from 'zod';


// const salaryParamsSchema = z.object({
//   salarieId: z.uuid(),
// });

// const transactionBodySchema = z.object({
//   amount: z.number().positive(),
//   status: z.enum(['REFUSER', 'VALIDER']),
//   type: z.enum(['PAYMENT', 'REFUND', 'TOPUP']),
// });

// export async function GET(request: Request, { params }: { params: Promise<{ salarieId: string }> })
// {
//   const { salarieId } = await salaryParamsSchema.parseAsync(await params);

//   try {
//     const transactions = await db.orm.public.Transaction.where({ userId: salarieId }).orderBy((u) => u.createdAt.desc()).all();
//     return Response.json({ transactions }, { status: 200 });
//   } catch (error) {
//     console.error('Error fetching salary transactions', error);
//     return Response.json({ error: 'Server error' }, { status: 500 });
//   }
// }


// export async function POST(request: Request, { params }: { params: Promise<{ salarieId: string }> })
// {
//     const { salarieId } = await salaryParamsSchema.parseAsync(await params);

//     try {
//         const requestBody = await request.json();
//         await transactionBodySchema.parseAsync(requestBody);
//         return Response.json({ message: 'Transaction created successfully' }, { status: 201 });
//     } catch (error) {
//         console.error('Error creating salary transaction', error);
//         return Response.json({ error: 'Server error' }, { status: 500 });
//     }
// }
