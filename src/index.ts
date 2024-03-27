import "dotenv/config";
import {
  AccountInfo,
  Connection,
  PublicKey,
  PublicKeyInitData,
  RpcResponseAndContext,
  TokenAmount as SolanaTokenAmount,
} from "@solana/web3.js";
import { LIQUIDITY_STATE_LAYOUT_V4 } from "@raydium-io/raydium-sdk";
import { Telegraf } from "telegraf";

interface PoolStatus {
  baseTokenAmount: RpcResponseAndContext<SolanaTokenAmount>;
  quoteTokenAmount: RpcResponseAndContext<SolanaTokenAmount>;
}

const RPC_URL = process.env.RPC_URL as string;
const WIF_SOL_POOL_ID = process.env.WIF_SOL_POOL_ID as string;
const OPENBOOK_PROGRAM_ID = new PublicKey(
  process.env.OPENBOOK_PROGRAM_ID as string
);
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN as string;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID as string;

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);
const connection = new Connection(RPC_URL, "confirmed");
let previousStatus: PoolStatus | null = null;

async function getPoolStatus(
  connection: Connection,
  poolId: PublicKeyInitData
): Promise<PoolStatus | null> {
  const info: AccountInfo<Buffer> | null = await connection.getAccountInfo(
    new PublicKey(poolId)
  );
  if (!info) return null;

  const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(info.data);
  const baseTokenAmount: RpcResponseAndContext<SolanaTokenAmount> =
    await connection.getTokenAccountBalance(poolState.baseVault);
  const quoteTokenAmount: RpcResponseAndContext<SolanaTokenAmount> =
    await connection.getTokenAccountBalance(poolState.quoteVault);

  return { baseTokenAmount, quoteTokenAmount };
}

async function checkLiquidityChange(): Promise<void> {
  const currentStatus: PoolStatus | null = await getPoolStatus(
    connection,
    WIF_SOL_POOL_ID
  );

  if (previousStatus && currentStatus) {
    const baseChange: number =
      Math.abs(
        currentStatus.baseTokenAmount.value.uiAmount! -
          previousStatus.baseTokenAmount.value.uiAmount!
      ) / previousStatus.baseTokenAmount.value.uiAmount!;

    if (baseChange > 0.05) {
      const message: string = "Liquidity change alert!";
      console.log(message);
      await bot.telegram.sendMessage(TELEGRAM_CHAT_ID, message);
    }
  }
  previousStatus = currentStatus;
}

setInterval(checkLiquidityChange, 60 * 1000);
