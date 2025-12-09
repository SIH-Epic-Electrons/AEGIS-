package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// PredictionContract provides functions for managing predictions
type PredictionContract struct {
	contractapi.Contract
}

// ATMLocation represents a single ATM location prediction
type ATMLocation struct {
	Rank       int     `json:"rank"`
	ATMID      string  `json:"atm_id"`
	Name       string  `json:"name"`
	Address    string  `json:"address"`
	Lat        float64 `json:"lat"`
	Lon        float64 `json:"lon"`
	Bank       string  `json:"bank"`
	City       string  `json:"city"`
	DistanceKm float64 `json:"distance_km"`
	Confidence float64 `json:"confidence"`
}

// ConfidenceScores represents confidence score data
type ConfidenceScores struct {
	Primary      float64   `json:"primary"`
	Alternatives []float64 `json:"alternatives"`
	Overall      float64   `json:"overall"`
}

// TimeWindow represents time window prediction
type TimeWindow struct {
	WindowStart string  `json:"window_start"`
	WindowEnd   string  `json:"window_end"`
	Confidence  float64 `json:"confidence"`
}

// ModelInfo represents model information
type ModelInfo struct {
	ModelName string `json:"model_name"`
	Version   string `json:"version"`
	Mode      string `json:"mode"`
}

// PredictionData represents the complete prediction data structure
type PredictionData struct {
	CaseID          string          `json:"caseId"`
	Top3ATMLocations []ATMLocation  `json:"top3AtmLocations"`
	ConfidenceScores ConfidenceScores `json:"confidenceScores"`
	TimeWindow      TimeWindow      `json:"timeWindow"`
	Timestamp       string          `json:"timestamp"`
	ModelInfo       ModelInfo       `json:"model_info"`
}

// StorePrediction stores prediction data on the blockchain
func (s *PredictionContract) StorePrediction(ctx contractapi.TransactionContextInterface, predictionJSON string) error {
	var prediction PredictionData

	err := json.Unmarshal([]byte(predictionJSON), &prediction)
	if err != nil {
		return fmt.Errorf("failed to unmarshal prediction: %v", err)
	}

	// Validate required fields
	if prediction.CaseID == "" {
		return fmt.Errorf("caseId is required")
	}

	if len(prediction.Top3ATMLocations) == 0 {
		return fmt.Errorf("at least one ATM location is required")
	}

	// Check if prediction already exists
	existingBytes, err := ctx.GetStub().GetState(prediction.CaseID)
	if err != nil {
		return fmt.Errorf("failed to read from world state: %v", err)
	}

	if existingBytes != nil {
		return fmt.Errorf("prediction for case %s already exists", prediction.CaseID)
	}

	// Convert to JSON for storage
	predictionBytes, err := json.Marshal(prediction)
	if err != nil {
		return fmt.Errorf("failed to marshal prediction: %v", err)
	}

	// Store with caseId as key
	return ctx.GetStub().PutState(prediction.CaseID, predictionBytes)
}

// UpdatePrediction updates existing prediction data
func (s *PredictionContract) UpdatePrediction(ctx contractapi.TransactionContextInterface, predictionJSON string) error {
	var prediction PredictionData

	err := json.Unmarshal([]byte(predictionJSON), &prediction)
	if err != nil {
		return fmt.Errorf("failed to unmarshal prediction: %v", err)
	}

	// Validate required fields
	if prediction.CaseID == "" {
		return fmt.Errorf("caseId is required")
	}

	// Check if prediction exists
	existingBytes, err := ctx.GetStub().GetState(prediction.CaseID)
	if err != nil {
		return fmt.Errorf("failed to read from world state: %v", err)
	}

	if existingBytes == nil {
		return fmt.Errorf("prediction for case %s does not exist", prediction.CaseID)
	}

	// Update timestamp
	prediction.Timestamp = time.Now().UTC().Format(time.RFC3339)

	// Convert to JSON for storage
	predictionBytes, err := json.Marshal(prediction)
	if err != nil {
		return fmt.Errorf("failed to marshal prediction: %v", err)
	}

	// Update state
	return ctx.GetStub().PutState(prediction.CaseID, predictionBytes)
}

// GetPrediction retrieves prediction data by caseId
func (s *PredictionContract) GetPrediction(ctx contractapi.TransactionContextInterface, caseID string) (*PredictionData, error) {
	predictionBytes, err := ctx.GetStub().GetState(caseID)
	if err != nil {
		return nil, fmt.Errorf("failed to read from world state: %v", err)
	}

	if predictionBytes == nil {
		return nil, fmt.Errorf("prediction for case %s does not exist", caseID)
	}

	var prediction PredictionData
	err = json.Unmarshal(predictionBytes, &prediction)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal prediction: %v", err)
	}

	return &prediction, nil
}

// QueryPredictionsByDateRange queries predictions within a date range
func (s *PredictionContract) QueryPredictionsByDateRange(ctx contractapi.TransactionContextInterface, startDate string, endDate string) ([]*PredictionData, error) {
	queryString := fmt.Sprintf(`{
		"selector": {
			"timestamp": {
				"$gte": "%s",
				"$lte": "%s"
			}
		}
	}`, startDate, endDate)

	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var predictions []*PredictionData
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var prediction PredictionData
		err = json.Unmarshal(queryResponse.Value, &prediction)
		if err != nil {
			return nil, err
		}

		predictions = append(predictions, &prediction)
	}

	return predictions, nil
}

// GetAllPredictions returns all predictions (use with caution in production)
func (s *PredictionContract) GetAllPredictions(ctx contractapi.TransactionContextInterface) ([]*PredictionData, error) {
	resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var predictions []*PredictionData
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var prediction PredictionData
		err = json.Unmarshal(queryResponse.Value, &prediction)
		if err != nil {
			return nil, err
		}

		predictions = append(predictions, &prediction)
	}

	return predictions, nil
}

// GetPredictionHistory returns the history of a specific prediction
func (s *PredictionContract) GetPredictionHistory(ctx contractapi.TransactionContextInterface, caseID string) ([]*PredictionData, error) {
	historyIterator, err := ctx.GetStub().GetHistoryForKey(caseID)
	if err != nil {
		return nil, err
	}
	defer historyIterator.Close()

	var history []*PredictionData
	for historyIterator.HasNext() {
		historyResponse, err := historyIterator.Next()
		if err != nil {
			return nil, err
		}

		var prediction PredictionData
		err = json.Unmarshal(historyResponse.Value, &prediction)
		if err != nil {
			return nil, err
		}

		history = append(history, &prediction)
	}

	return history, nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&PredictionContract{})
	if err != nil {
		fmt.Printf("Error creating prediction chaincode: %v", err)
		return
	}

	if err := chaincode.Start(); err != nil {
		fmt.Printf("Error starting prediction chaincode: %v", err)
	}
}

