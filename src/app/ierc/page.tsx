"use client";

import {
  Button,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  TextField,
} from "@mui/material";
import { useCallback, useMemo, useRef, useState } from "react";
import { Hex } from "viem";

import Log from "@/components/Log";
import useIsClient from "@/hooks/useIsClient";
import { handleLog } from "@/utils/helper";

type RadioType = "prod" | "test";

interface IWorkerData {
  log?: string;
  mineRate?: number;
}

export default function Ierc() {
  const workers = useRef<Worker[]>([]);
  const [radio, setRadio] = useState<RadioType>("prod");
  const [privateKey, setPrivateKey] = useState<Hex>();
  const [rpc, setRpc] = useState<string>();
  const [tick, setTick] = useState<string>("");
  const [amount, setAmount] = useState<number>(0);
  const [difficulty, setDifficulty] = useState<string>("");
  const [gasPremium, setGasPremium] = useState<number>(110);
  const [cpu, setCpu] = useState<number>(1);
  const [running, setRunning] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [mineRateList, setMineRateList] = useState<number[]>([]);
  const [successCount, setSuccessCount] = useState<number>(0);
  const [customCpu, setCustomCpu] = useState<number>(0);

  const isClient = useIsClient();
  const coreCount = useMemo(
    () => (isClient ? navigator.hardwareConcurrency : 1),
    [isClient],
  );

  const mineRate = useMemo(() => {
    return mineRateList.reduce((a, b) => a + b, 0);
  }, [mineRateList]);

  const pushLog = useCallback((log: string, state?: string) => {
    setLogs((logs) => [handleLog(log, state), ...logs]);
  }, []);

  const generateWorkers = useCallback(() => {
    const newWorkers = [];
    const cpuCount = customCpu > 0 ? customCpu : cpu;
    for (let i = 0; i < cpuCount; i++) {
      const worker = new Worker(new URL("./mine.js", import.meta.url));
      newWorkers.push(worker);

      worker.postMessage({
        index: i,
        privateKey,
        rpc,
        tick,
        amount,
        difficulty,
        gasPremium,
        env: radio,
      });

      worker.onerror = (e) => {
        pushLog(`Worker ${i} error: ${e.message}`, "error");
      };
      worker.onmessage = (e) => {
        const data = e.data as IWorkerData;
        if (data.log) {
          pushLog(data.log);
          setSuccessCount((count) => count + 1);
        }
        if (data.mineRate) {
          const rate = data.mineRate;
          setMineRateList((list) => {
            const newList = [...list];
            newList[i] = rate;
            return newList;
          });
        }
      };
    }
    workers.current = newWorkers;
  }, [
    amount,
    cpu,
    customCpu,
    difficulty,
    gasPremium,
    privateKey,
    pushLog,
    radio,
    rpc,
    tick,
  ]);

  const run = useCallback(() => {
    if (!privateKey) {
      pushLog("No private key", "error");
      setRunning(false);
      return;
    }

    if (!tick) {
      pushLog("No tick", "error");
      setRunning(false);
      return;
    }

    if (!amount) {
      pushLog("No amount", "error");
      setRunning(false);
      return;
    }

    if (!difficulty) {
      pushLog("No difficulty", "error");
      setRunning(false);
      return;
    }

    pushLog("🚀🚀🚀 Start Mining...");

    generateWorkers();
  }, [amount, difficulty, generateWorkers, privateKey, pushLog, tick]);

  const end = useCallback(() => {
    workers.current?.forEach((worker) => {
      worker.terminate();
    });
    workers.current = [];
  }, []);

  return (
    <div className=" flex flex-col gap-4">
      <RadioGroup
        row
        defaultValue="prod"
        onChange={(e) => {
          const value = e.target.value as RadioType;
          setRadio(value);
        }}
      >
        <FormControlLabel
          value="prod"
          control={<Radio />}
          label="Production Environment"
          disabled={running}
        />
        <FormControlLabel
          value="test"
          control={<Radio />}
          label="Test Environment"
          disabled={running}
        />
      </RadioGroup>

      <div className=" flex flex-col gap-2">
        <span>Private Key (Required):</span>
        <TextField
          size="small"
          placeholder="Private key, with or without 0x, the program will handle it automatically"
          disabled={running}
          onChange={(e) => {
            const text = e.target.value;
            const key = text.trim();
            if (/^[a-fA-F0-9]{64}$/.test(key)) {
              setPrivateKey(`0x${key}`);
            }
            if (/^0x[a-fA-F0-9]{64}$/.test(key)) {
              setPrivateKey(key as Hex);
            }
          }}
        />
      </div>

      <div className=" flex flex-col gap-2">
        <span>Tick (Required, example: ierc-m5):</span>
        <TextField
          size="small"
          placeholder="tick, example: ierc-m5"
          disabled={running}
          onChange={(e) => {
            const text = e.target.value;
            setTick(text.trim());
          }}
        />
      </div>

      <div className=" flex flex-col gap-2">
        <span>Amount (Required, amount per item):</span>
        <TextField
          type="number"
          size="small"
          placeholder="Amount, example: 10000"
          disabled={running}
          onChange={(e) => {
            const num = Number(e.target.value);
            !Number.isNaN(num) && num >= 0 && setAmount(num);
          }}
        />
      </div>

      <div className=" flex flex-col gap-2">
        <span>Difficulty (Required, hexadecimal, example: 0x00000):</span>
        <TextField
          size="small"
          placeholder="Difficulty, hexadecimal, example: 0x00000"
          disabled={running}
          onChange={(e) => {
            const text = e.target.value;
            setDifficulty(text.trim());
          }}
        />
      </div>

      <div className=" flex flex-col gap-2">
        <div className=" flex items-center gap-2">
          <span>CPU Core Count:</span>
          <Button
            size="small"
            color="secondary"
            disabled={running}
            onClick={() => {
              setCustomCpu((_customCpu) => (_customCpu <= 0 ? 1 : -1));
              setMineRateList([]);
            }}
          >
            Custom
          </Button>
        </div>
        {customCpu <= 0 ? (
          <TextField
            select
            defaultValue={1}
            size="small"
            disabled={running}
            onChange={(e) => {
              const text = e.target.value;
              setCpu(Number(text));
              setMineRateList([]);
            }}
          >
            {new Array(coreCount).fill(null).map((_, index) => (
              <MenuItem
                key={index}
                value={index + 1}
              >
                {index + 1}
              </MenuItem>
            ))}
          </TextField>
        ) : (
          <TextField
            type="number"
            size="small"
            placeholder="CPU core count, example: 12"
            disabled={running}
            value={customCpu}
            onChange={(e) => {
              const num = Number(e.target.value);
              !Number.isNaN(num) && setCustomCpu(Math.floor(num));
            }}
          />
        )}
      </div>

      <div className=" flex flex-col gap-2">
        <span>RPC (Optional, default public, http, best to use your own):</span>
        <TextField
          size="small"
          placeholder="RPC"
          disabled={running}
          onChange={(e) => {
            const text = e.target.value;
            setRpc(text);
          }}
        />
      </div>

      <div className=" flex flex-col gap-2">
        <span>
          Gas Premium (Optional, the gasPrice at startup multiplied by the
          premium is the max gas paid):
        </span>
        <TextField
          type="number"
          size="small"
          placeholder="Default 110 (which is 1.1x multiplier), minimum 100, example: 110"
          disabled={running}
          onChange={(e) => {
            const num = Number(e.target.value);
            !Number.isNaN(num) && num >= 100 && setGasPremium(num);
          }}
        />
      </div>

      <Button
        variant="contained"
        color={running ? "error" : "success"}
        onClick={() => {
          if (!running) {
            setRunning(true);
            run();
          } else {
            setRunning(false);
            end();
          }
        }}
      >
        {running ? "Running" : "Run"}
      </Button>

      <Log
        title={`Log (Efficiency => ${mineRate} c/s Success Count => ${successCount}):`}
        logs={logs}
        onClear={() => {
          setLogs([]);
        }}
      />
    </div>
  );
}
