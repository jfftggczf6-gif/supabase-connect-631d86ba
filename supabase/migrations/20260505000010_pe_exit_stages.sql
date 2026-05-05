-- Phase G — Ajout des stages de sortie au pipeline
ALTER TYPE pe_deal_stage ADD VALUE IF NOT EXISTS 'exit_prep';
ALTER TYPE pe_deal_stage ADD VALUE IF NOT EXISTS 'exited';
