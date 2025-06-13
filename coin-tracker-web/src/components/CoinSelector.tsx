import React, { useState, useEffect } from 'react';
import { 
  Autocomplete, 
  TextField, 
  Box, 
  Typography, 
  Button 
} from '@mui/material';
import { getCoinSymbols, CoinSymbol } from '../services/api';

interface CoinSelectorProps {
  onSymbolSelect: (symbol: string) => void;
}

const CoinSelector: React.FC<CoinSelectorProps> = ({ onSymbolSelect }) => {
  const [symbols, setSymbols] = useState<CoinSymbol[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<CoinSymbol | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSymbols = async () => {
      setLoading(true);
      try {
        const symbolList = await getCoinSymbols();
        setSymbols(symbolList);
      } catch (error) {
        console.error('종목 목록 로딩 실패:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSymbols();
  }, []);

  const handleAddChart = () => {
    if (selectedSymbol) {
      onSymbolSelect(selectedSymbol.symbol);
      setSelectedSymbol(null); // 선택 초기화
    }
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 2, 
      mb: 2,
      p: 2,
      bgcolor: 'background.paper',
      borderRadius: 1,
      boxShadow: 1
    }}>
      <Typography variant="h6" sx={{ minWidth: 'fit-content' }}>
        차트 추가:
      </Typography>
      
      <Autocomplete
        sx={{ minWidth: 300 }}
        options={symbols}
        getOptionLabel={(option) => `${option.symbol}${option.name && option.name !== option.symbol ? ` (${option.name})` : ''}`}
        value={selectedSymbol}
        onChange={(_, newValue) => setSelectedSymbol(newValue)}
        loading={loading}
        renderInput={(params) => (
          <TextField
            {...params}
            label="종목 선택"
            placeholder="종목명 또는 심볼 입력..."
            variant="outlined"
            size="small"
          />
        )}
        renderOption={(props, option) => (
          <Box component="li" {...props}>
            <Box>
              <Typography variant="body1" fontWeight="bold">
                {option.symbol}
              </Typography>
              {option.name && option.name !== option.symbol && (
                <Typography variant="body2" color="text.secondary">
                  {option.name}
                </Typography>
              )}
            </Box>
          </Box>
        )}
        filterOptions={(options, { inputValue }) => {
          const filtered = options.filter(option =>
            option.symbol.toLowerCase().includes(inputValue.toLowerCase()) ||
            (option.name && option.name.toLowerCase().includes(inputValue.toLowerCase()))
          );
          return filtered.slice(0, 50); // 최대 50개까지만 표시
        }}
        noOptionsText="검색 결과가 없습니다"
        loadingText="로딩 중..."
      />
      
      <Button
        variant="contained"
        onClick={handleAddChart}
        disabled={!selectedSymbol}
        sx={{ minWidth: 'fit-content' }}
      >
        차트 추가
      </Button>
    </Box>
  );
};

export default CoinSelector; 