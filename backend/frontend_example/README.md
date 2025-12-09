# 🎨 Frontend Graph Visualization Example

## Overview

This is a complete frontend example showing how to visualize the money flow graph from the AEGIS API.

## Files

- `graph_visualization.html` - Complete standalone HTML page with graph visualization

## Features

✅ **Interactive Graph Visualization**
- Uses vis.js library for rendering
- Shows nodes (accounts) and edges (transactions)
- Color-coded: Green (Victim), Orange (Mule), Blue (Regular)

✅ **Real-time Data Loading**
- Fetches data from `/api/v1/graph/case/{case_id}/visualization`
- Handles authentication
- Error handling and loading states

✅ **Interactive Features**
- Hover tooltips with account details
- Click to select nodes
- Zoom and pan
- Smooth animations

✅ **Information Panel**
- Case number
- Total accounts
- Mule account count
- Transaction statistics
- Amount totals

## Usage

### Option 1: Direct HTML File
1. Open `graph_visualization.html` in a web browser
2. Enter your Case ID
3. Click "Load Graph"

### Option 2: With Authentication
1. Get your auth token from `/api/v1/auth/login`
2. Click "Load with Auth Token"
3. Paste your token
4. Graph will load automatically

### Option 3: URL Parameter
```
graph_visualization.html?case_id=22f20988-a68d-401f-9cbe-68d4c9fe9855
```

## API Endpoint Used

```
GET /api/v1/graph/case/{case_id}/visualization
```

**Response Format:**
```json
{
  "success": true,
  "data": {
    "nodes": [...],
    "edges": [...],
    "case_id": "...",
    "case_number": "..."
  }
}
```

## Customization

### Change API URL
Edit the `API_BASE_URL` constant:
```javascript
const API_BASE_URL = 'http://your-api-url:8000/api/v1';
```

### Change Colors
Edit the node colors in the `renderGraph` function or use the colors from the API response.

### Change Layout
Modify the `options` object in `renderGraph()` to change:
- Physics simulation
- Node shapes
- Edge styles
- Layout algorithm

## Libraries Used

- **vis.js** - Graph visualization library
- Loaded from CDN: `https://unpkg.com/vis-network/standalone/umd/vis-network.min.js`

## Integration with Your Frontend

### React Example:
```jsx
import { useEffect, useRef } from 'react';
import { Network } from 'vis-network';

function GraphVisualization({ caseId }) {
  const containerRef = useRef(null);
  
  useEffect(() => {
    fetch(`/api/v1/graph/case/${caseId}/visualization`)
      .then(res => res.json())
      .then(data => {
        const network = new Network(
          containerRef.current,
          { nodes: data.data.nodes, edges: data.data.edges },
          options
        );
      });
  }, [caseId]);
  
  return <div ref={containerRef} style={{ height: '700px' }} />;
}
```

### Vue Example:
```vue
<template>
  <div ref="graphContainer" style="height: 700px;"></div>
</template>

<script>
import { Network } from 'vis-network';

export default {
  async mounted() {
    const response = await fetch(`/api/v1/graph/case/${this.caseId}/visualization`);
    const data = await response.json();
    
    new Network(
      this.$refs.graphContainer,
      { nodes: data.data.nodes, edges: data.data.edges },
      options
    );
  }
}
</script>
```

## Troubleshooting

### CORS Issues
If you get CORS errors, make sure your API has CORS enabled:
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Authentication
If you get 401 errors:
1. Login first: `POST /api/v1/auth/login`
2. Copy the `access_token`
3. Use "Load with Auth Token" button
4. Or set in localStorage: `localStorage.setItem('aegis_auth_token', 'your-token')`

### Graph Not Loading
1. Check browser console for errors
2. Verify API is running: `http://127.0.0.1:8000`
3. Verify Case ID exists
4. Check network tab for API response

## Next Steps

1. **Integrate into your frontend framework** (React, Vue, Angular)
2. **Add more interactivity** (filtering, searching, highlighting)
3. **Add animations** (transaction flow animation)
4. **Export functionality** (PNG, SVG, PDF)
5. **Real-time updates** (WebSocket for live updates)

---

**Ready to visualize money flow!** 🎉

