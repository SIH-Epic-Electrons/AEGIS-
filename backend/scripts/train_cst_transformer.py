"""
Train Unified CST Transformer.

Dual-mode model training:
1. ATM Mode: Victim location → Predict withdrawal ATM
2. Area Mode: No victim location → Predict general area

Single model handles both cases.
"""

import sys
from pathlib import Path
import argparse
import logging
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.amp import autocast, GradScaler
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.ml.preprocessing.cst_data_loader import CSTDataLoader
from app.ml.models.cst_transformer import CSTTransformer, compute_cst_loss

logging.basicConfig(level=logging.INFO, format='%(levelname)s:%(name)s:%(message)s')
logger = logging.getLogger(__name__)


class CSTTrainer:
    """Trainer for unified CST Transformer."""
    
    def __init__(self, model: CSTTransformer, train_loader, val_loader,
                 device: str = "cuda", lr: float = 1e-4):
        """Initialize trainer."""
        self.model = model.to(device)
        self.device = device
        self.train_loader = train_loader
        self.val_loader = val_loader
        
        self.optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=0.01)
        self.scheduler = torch.optim.lr_scheduler.CosineAnnealingWarmRestarts(
            self.optimizer, T_0=10, T_mult=2
        )
        
        self.scaler = GradScaler("cuda")
        self.use_amp = device == "cuda"
        
        self.best_val_loss = float("inf")
        self.patience_counter = 0
    
    def train_epoch(self, epoch: int):
        """Train for one epoch."""
        self.model.train()
        
        total_loss = 0.0
        total_atm_acc = 0.0
        total_top5_acc = 0.0
        atm_batches = 0
        num_batches = 0
        
        pbar = tqdm(self.train_loader, desc=f"Epoch {epoch+1}")
        
        for batch in pbar:
            # Move to device
            victim_coords = batch["victim_coords"].to(self.device)
            target_coords = batch["target_coords"].to(self.device)
            fraud_type = batch["fraud_type"].to(self.device)
            state = batch["state"].to(self.device)
            hour = batch["hour"].to(self.device)
            day = batch["day"].to(self.device)
            month = batch["month"].to(self.device)
            target_atm = batch["target_atm"].to(self.device)
            is_atm_mode = batch["is_atm_mode"].to(self.device)
            
            self.optimizer.zero_grad()
            
            # Separate ATM and Area mode samples
            atm_mask = is_atm_mode
            area_mask = ~is_atm_mode
            
            loss = torch.tensor(0.0, device=self.device)
            loss_dict = {"total": 0, "atm": 0, "coord": 0, "accuracy": 0, "top5_accuracy": 0}
            
            # ATM mode forward pass
            if atm_mask.any():
                if self.use_amp:
                    with autocast("cuda"):
                        atm_out = self.model(
                            victim_coords[atm_mask], hour[atm_mask], day[atm_mask],
                            month[atm_mask], fraud_type[atm_mask], state[atm_mask],
                            mode="atm"
                        )
                        atm_loss, atm_losses = compute_cst_loss(
                            atm_out, target_atm[atm_mask], target_coords[atm_mask], "atm"
                        )
                else:
                    atm_out = self.model(
                        victim_coords[atm_mask], hour[atm_mask], day[atm_mask],
                        month[atm_mask], fraud_type[atm_mask], state[atm_mask],
                        mode="atm"
                    )
                    atm_loss, atm_losses = compute_cst_loss(
                        atm_out, target_atm[atm_mask], target_coords[atm_mask], "atm"
                    )
                
                loss = loss + atm_loss * atm_mask.sum() / len(atm_mask)
                total_atm_acc += atm_losses.get("accuracy", 0)
                total_top5_acc += atm_losses.get("top5_accuracy", 0)
                atm_batches += 1
            
            # Area mode forward pass
            if area_mask.any():
                if self.use_amp:
                    with autocast("cuda"):
                        area_out = self.model(
                            victim_coords[area_mask], hour[area_mask], day[area_mask],
                            month[area_mask], fraud_type[area_mask], state[area_mask],
                            mode="area"
                        )
                        area_loss, area_losses = compute_cst_loss(
                            area_out, None, target_coords[area_mask], "area"
                        )
                else:
                    area_out = self.model(
                        victim_coords[area_mask], hour[area_mask], day[area_mask],
                        month[area_mask], fraud_type[area_mask], state[area_mask],
                        mode="area"
                    )
                    area_loss, area_losses = compute_cst_loss(
                        area_out, None, target_coords[area_mask], "area"
                    )
                
                loss = loss + area_loss * area_mask.sum() / len(area_mask)
            
            # Backward pass
            if self.use_amp:
                self.scaler.scale(loss).backward()
                self.scaler.unscale_(self.optimizer)
                nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
                self.scaler.step(self.optimizer)
                self.scaler.update()
            else:
                loss.backward()
                nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
                self.optimizer.step()
            
            total_loss += loss.item()
            num_batches += 1
            
            pbar.set_postfix({
                "loss": f"{loss.item():.4f}",
                "atm_acc": f"{total_atm_acc/max(1,atm_batches)*100:.1f}%",
            })
        
        return {
            "loss": total_loss / num_batches,
            "atm_accuracy": total_atm_acc / max(1, atm_batches),
            "top5_accuracy": total_top5_acc / max(1, atm_batches),
        }
    
    @torch.no_grad()
    def validate(self):
        """Validate on validation set."""
        self.model.eval()
        
        total_loss = 0.0
        total_atm_acc = 0.0
        total_top5_acc = 0.0
        atm_batches = 0
        num_batches = 0
        
        for batch in self.val_loader:
            victim_coords = batch["victim_coords"].to(self.device)
            target_coords = batch["target_coords"].to(self.device)
            fraud_type = batch["fraud_type"].to(self.device)
            state = batch["state"].to(self.device)
            hour = batch["hour"].to(self.device)
            day = batch["day"].to(self.device)
            month = batch["month"].to(self.device)
            target_atm = batch["target_atm"].to(self.device)
            is_atm_mode = batch["is_atm_mode"].to(self.device)
            
            atm_mask = is_atm_mode
            area_mask = ~is_atm_mode
            
            loss = torch.tensor(0.0, device=self.device)
            
            if atm_mask.any():
                atm_out = self.model(
                    victim_coords[atm_mask], hour[atm_mask], day[atm_mask],
                    month[atm_mask], fraud_type[atm_mask], state[atm_mask],
                    mode="atm"
                )
                atm_loss, atm_losses = compute_cst_loss(
                    atm_out, target_atm[atm_mask], target_coords[atm_mask], "atm"
                )
                loss = loss + atm_loss * atm_mask.sum() / len(atm_mask)
                total_atm_acc += atm_losses.get("accuracy", 0)
                total_top5_acc += atm_losses.get("top5_accuracy", 0)
                atm_batches += 1
            
            if area_mask.any():
                area_out = self.model(
                    victim_coords[area_mask], hour[area_mask], day[area_mask],
                    month[area_mask], fraud_type[area_mask], state[area_mask],
                    mode="area"
                )
                area_loss, _ = compute_cst_loss(
                    area_out, None, target_coords[area_mask], "area"
                )
                loss = loss + area_loss * area_mask.sum() / len(area_mask)
            
            total_loss += loss.item()
            num_batches += 1
        
        return {
            "loss": total_loss / num_batches,
            "atm_accuracy": total_atm_acc / max(1, atm_batches),
            "top5_accuracy": total_top5_acc / max(1, atm_batches),
        }
    
    def save_checkpoint(self, path: str, epoch: int, val_metrics: dict):
        """Save model checkpoint."""
        torch.save({
            "epoch": epoch,
            "model_state_dict": self.model.state_dict(),
            "optimizer_state_dict": self.optimizer.state_dict(),
            "val_loss": val_metrics["loss"],
            "val_atm_accuracy": val_metrics["atm_accuracy"],
            "val_top5_accuracy": val_metrics["top5_accuracy"],
            "model_config": {
                "d_model": self.model.d_model,
                "num_atms": self.model.num_atms,
            }
        }, path)
    
    def train(self, epochs: int, patience: int, checkpoint_dir: str):
        """Full training loop."""
        checkpoint_path = Path(checkpoint_dir)
        checkpoint_path.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Starting training for {epochs} epochs")
        
        for epoch in range(epochs):
            train_metrics = self.train_epoch(epoch)
            val_metrics = self.validate()
            self.scheduler.step()
            
            logger.info(
                f"Epoch {epoch+1}/{epochs} | "
                f"Train Loss: {train_metrics['loss']:.4f} | "
                f"Val Loss: {val_metrics['loss']:.4f} | "
                f"ATM Acc: {val_metrics['atm_accuracy']*100:.1f}% | "
                f"Top5: {val_metrics['top5_accuracy']*100:.1f}%"
            )
            
            if val_metrics["loss"] < self.best_val_loss:
                self.best_val_loss = val_metrics["loss"]
                self.patience_counter = 0
                self.save_checkpoint(str(checkpoint_path / "best_model.pt"), epoch, val_metrics)
                logger.info(f"✓ Saved best model (loss: {val_metrics['loss']:.4f})")
            else:
                self.patience_counter += 1
            
            if self.patience_counter >= patience:
                logger.info(f"Early stopping at epoch {epoch+1}")
                break
        
        logger.info(f"Training complete. Best val loss: {self.best_val_loss:.4f}")
        return self.best_val_loss


def main():
    parser = argparse.ArgumentParser(description="Train Unified CST Transformer")
    parser.add_argument("--epochs", type=int, default=60)
    parser.add_argument("--patience", type=int, default=15)
    parser.add_argument("--batch_size", type=int, default=256)
    parser.add_argument("--lr", type=float, default=1e-4)
    parser.add_argument("--d_model", type=int, default=256)
    args = parser.parse_args()
    
    print("\n" + "="*70)
    print("UNIFIED CST TRANSFORMER - TRAINING")
    print("="*70)
    print("Dual-mode model:")
    print("  1. ATM Mode: Victim location → Top 3 ATMs")
    print("  2. Area Mode: Anonymous → General area")
    print(f"Epochs: {args.epochs}, Patience: {args.patience}")
    print("="*70 + "\n")
    
    device = "cuda" if torch.cuda.is_available() else "cpu"
    
    # Load data
    logger.info("Loading unified CST data...")
    data_loader = CSTDataLoader()
    df = data_loader.load_data()
    
    train_ds, val_ds, test_ds = data_loader.prepare_datasets(df)
    train_loader, val_loader = data_loader.get_data_loaders(train_ds, val_ds, args.batch_size)
    
    # Get vocab sizes
    num_fraud_types = len(data_loader.fraud_encoder.classes_)
    num_states = len(data_loader.state_encoder.classes_)
    num_atms = data_loader.num_atms
    
    logger.info(f"Fraud types: {num_fraud_types}")
    logger.info(f"States: {num_states}")
    logger.info(f"ATMs: {num_atms}")
    
    # Create model
    model = CSTTransformer(
        d_model=args.d_model,
        n_heads=8,
        n_layers=4,
        num_fraud_types=num_fraud_types,
        num_states=num_states,
        num_atms=num_atms,
        dropout=0.2,
    )
    
    num_params = sum(p.numel() for p in model.parameters())
    logger.info(f"Model parameters: {num_params:,}")
    logger.info(f"Device: {device}")
    
    # Train
    trainer = CSTTrainer(model, train_loader, val_loader, device, args.lr)
    checkpoint_dir = "checkpoints/cst_unified"
    best_loss = trainer.train(args.epochs, args.patience, checkpoint_dir)
    
    # Save encoders
    data_loader.save_encoders(f"{checkpoint_dir}/encoders.pkl")
    
    print("\n" + "="*70)
    print("TRAINING COMPLETE")
    print("="*70)
    print(f"Best validation loss: {best_loss:.4f}")
    print(f"Model: {checkpoint_dir}/best_model.pt")
    print(f"Encoders: {checkpoint_dir}/encoders.pkl")
    print("="*70)


if __name__ == "__main__":
    main()
