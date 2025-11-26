class Plotter {
    constructor(containerId, xSelectId, ySelectId, plotButtonId, chartTypeId) {
        this.container = document.getElementById(containerId);
        this.xSelect = document.getElementById(xSelectId);
        this.ySelect = document.getElementById(ySelectId);
        this.plotButton = document.getElementById(plotButtonId);
        this.chartTypeSelect = document.getElementById(chartTypeId);
        this.processedData = null;

        this.plotButton.addEventListener('click', () => {
            this.generatePlot();
        });
    }

    // Stores the data and populates the dropdowns
    loadData(data) {
        this.processedData = data;
        this.populateColumnSelects();
    }

    // Populates the dropdown menus with column names from the data
    populateColumnSelects() {
        if (!this.processedData || this.processedData.length === 0) {
            return;
        }

        const columnNames = Object.keys(this.processedData[0]);
        this.xSelect.innerHTML = '';
        this.ySelect.innerHTML = '';

        columnNames.forEach(col => {
            const optionX = document.createElement('option');
            optionX.value = col;
            optionX.textContent = col;
            this.xSelect.appendChild(optionX);

            const optionY = document.createElement('option');
            optionY.value = col;
            optionY.textContent = col;
            this.ySelect.appendChild(optionY);
        });

        if (columnNames.length > 1) {
            this.xSelect.value = columnNames[0];
            this.ySelect.value = columnNames[1];
        }
    }
    
async generatePlot() { 
    const xColumn = this.xSelect.value;
    const yColumn = this.ySelect.value;
    const chartType = this.chartTypeSelect.value;
    const statusMessage = document.getElementById('status-message');

    if (!this.processedData) {
        statusMessage.textContent = 'Please upload a file first.';
        statusMessage.className = 'status-message error-message';
        return;
    }

    let trace = null;
    let layout = {};

    // --- 1. HEATMAP LOGIC (Fetch from Backend) ---
    if (chartType === 'heatmap') {
        try {
            statusMessage.textContent = 'Calculating correlation matrix...';
            statusMessage.className = 'status-message';
            
            const response = await fetch('/heatmap_data', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.processedData), 
            });

            const data = await response.json(); 
            
            if (!response.ok) {
                 throw new Error(data.error || `Server error: ${response.status}`);
            }

            trace = this.getHeatmapTrace(data.z, data.labels);
            layout = this.getHeatmapLayout(data.labels);

            statusMessage.textContent = 'Heatmap generated successfully!';
            statusMessage.className = 'status-message success-message';
            
        } catch (error) {
            statusMessage.textContent = `Error generating heatmap: ${error.message}`;
            statusMessage.className = 'status-message error-message';
            console.error('Heatmap generation failed:', error);
            return;
        }
        
    } else {
        // --- 2. SCATTER/BAR/BOX DATA FETCHING AND VALIDATION ---
        
        if (!xColumn || !yColumn) {
             statusMessage.textContent = 'Please select columns for X and Y axes.';
             statusMessage.className = 'status-message error-message';
             return;
        }
        
        let xData, yData;
        
        if (chartType === 'bar' || chartType === 'box') {
            // Check for transposition
            const categoryExists = this.processedData.length > 0 && 
                                   'Category' in this.processedData[0];
            
            // Use 'Category' for X if transposed, otherwise use user's selection
            const xColumnToUse = categoryExists ? 'Category' : xColumn; 
            
            xData = this.processedData.map(row => row[xColumnToUse]);
            yData = this.processedData.map(row => row[yColumn]);
            
            // Validation: Y-axis must not be the category column
            if (yColumn === xColumnToUse && categoryExists) { 
                 statusMessage.textContent = `Error: Cannot plot the category column ("${xColumnToUse}") on the Y-axis. Please select a numerical column.`;
                 statusMessage.className = 'status-message error-message';
                 return;
            }

            statusMessage.textContent = 'Plot generated successfully!';
            statusMessage.className = 'status-message success-message';
            
        } else { // Scatter plot logic
            xData = this.processedData.map(row => row[xColumn]);
            yData = this.processedData.map(row => row[yColumn]);
            
            // Scatter validation (simplified for clean data)
            const isXNumeric = typeof xData[0] === 'number'; // Check data type via first value
            const isYNumeric = typeof yData[0] === 'number';

            if (!isXNumeric || !isYNumeric) {
                statusMessage.textContent = 'Warning: Scatter plots are best for comparing two numerical variables. Try selecting numerical columns for both axes.';
                statusMessage.className = 'status-message error-message';
            } else {
                statusMessage.textContent = 'Plot generated successfully!';
                statusMessage.className = 'status-message success-message';
            }
        }
        
        // --- 3. Final trace and layout assignment for non-heatmap plots ---
        switch (chartType) {
            case 'scatter':
                trace = this.getScatterTrace(xData, yData, xColumn, yColumn);
                layout = this.getLayout(xColumn, yColumn, 'Scatter Plot');
                break;
            case 'bar':
                trace = this.getBarTrace(xData, yData, xColumn, yColumn);
                layout = this.getLayout(xColumn, yColumn, 'Bar Chart');
                break;
            case 'box':
                trace = this.getBoxTrace(xData, yData, xColumn, yColumn);
                layout = this.getLayout(xColumn, yColumn, 'Box Plot');
                break;
        }
    }
    
    // --- 4. Plotly Rendering (Final step for ALL plots) ---
    if (trace && layout) {
        Plotly.newPlot(this.container, [trace], layout, { responsive: true }).then(() => {
            this._addEditingListeners();
        });
    }
}

    _addEditingListeners() {
        this.container.on('plotly_doubleclick', (event) => {
            const statusMessage = document.getElementById('status-message');
            
            const isXaxisTitle = event && event.points && event.points[0].data.name && event.points[0].data.name.includes('xaxis');
            const isYaxisTitle = event && event.points && event.points[0].data.name && event.points[0].data.name.includes('yaxis');
            
            if (isXaxisTitle || isYaxisTitle) {
                const axisName = isXaxisTitle ? 'xaxis' : 'yaxis';
                const layout = this.container.layout;
                
                const input = document.createElement('input');
                input.type = 'text';
                input.value = layout[axisName].title.text || '';
                input.style.position = 'absolute';
                input.style.left = event.event.clientX + 'px';
                input.style.top = event.event.clientY + 'px';
                input.style.zIndex = 1000;
                document.body.appendChild(input);

                input.focus();
                input.select();

                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        const newTitle = input.value;
                        const update = {};
                        update[`${axisName}.title.text`] = newTitle;
                        Plotly.relayout(this.container, update);
                        document.body.removeChild(input);
                    }
                });

                input.addEventListener('blur', () => {
                    document.body.removeChild(input);
                });
            } else {
                statusMessage.textContent = 'Please double-click on an axis title to edit it.';
                statusMessage.className = 'status-message error-message';
            }
        });
    }

    getLayout(xColumn, yColumn, title) {
        return {
            title: `${title} of ${xColumn} vs ${yColumn}`,
            xaxis: { title: xColumn },
            yaxis: { title: yColumn },
            margin: {
            b: 150, 
        }
        };
    }
    
    getScatterTrace(xData, yData, xColumn, yColumn) {
        return {
            x: xData,
            y: yData,
            mode: 'markers',
            type: 'scatter',
            name: `${xColumn} vs ${yColumn}`
        };
    }
    
    getBarTrace(xData, yData, xColumn, yColumn) {
        return {
            x: xData,
            y: yData,
            type: 'bar',
            name: `Counts for ${yColumn}`
        };
    }

    getBoxTrace(xData, yData, xColumn, yColumn) {
        return {
            x: xData,
            y: yData,
            type: 'box',
            name: `Distribution for ${yColumn}`
        };
    }

    getHeatmapTrace(zData, labels) {
    return {
        z: zData, // The N x N matrix of correlation values
        x: labels, // Column names for the x-axis
        y: labels, // Column names for the y-axis
        type: 'heatmap',
        colorscale: 'RdBu', // Red-Blue is standard for correlation
        reversescale: true, 
        zmin: -1, // Ensure the scale goes from -1 to 1 for perfect correlation
        zmax: 1
    };
    }

    getHeatmapLayout(labels) {
        return {
            title: 'Correlation Heatmap',
            xaxis: { 
                title: 'Variable',
                tickangle: -45, 
                dtick: 1,
            },
            yaxis: { 
                title: 'Variable',
                dtick: 1, 
                tickmode: 'auto',

            },
            margin: {
                t: 150, 
                r: 10,
                l: 250, 
                b: 150, 
            }
        };
    }
}